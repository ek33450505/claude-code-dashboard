import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PORT, HOST, DASHBOARD_COMMANDS_DIR, CORS_ORIGIN } from './constants.js'
import { router } from './routes/index.js'
import { controlGate, defaultDenyGate, GATED_PREFIXES, isControlEnabled, SAFE_METHODS } from './middleware/controlGate.js'
import { attachSSE } from './watchers/sse.js'
import { getCastDb } from './routes/castDb.js'
import { logSchemaDrift } from './utils/schemaGuard.js'

// Ensure dashboard commands directory exists BEFORE watchers start. Guarded
// (like all runtime side-effects below) so importing this module under test does
// not create directories under the real $HOME.
if (!process.env.VITEST) {
  fs.mkdirSync(DASHBOARD_COMMANDS_DIR, { recursive: true })
}

// Exported so integration tests can import the fully-wired app (see
// __tests__/controlGateWiring.test.ts). Runtime startup side-effects
// (mkdir, file watchers, port bind) are guarded behind !process.env.VITEST
// so importing this module under test is side-effect-free.
export const app = express()

// Security headers. CSP is intentionally left off: the production build is a
// bundled SPA whose chart/animation libraries set inline styles, and this server
// is intended for localhost. Enable a tuned CSP before exposing beyond localhost.
app.use(helmet({ contentSecurityPolicy: false }))

app.use(express.json({ limit: '256kb' }))

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', CORS_ORIGIN)
  // A cache/proxy in front of this server must not serve one origin's CORS
  // header to a different origin — Vary: Origin tells it to key on Origin too.
  res.header('Vary', 'Origin')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Dashboard-Token')
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

// IMPORTANT: each `rateLimit()` instance below owns ONE shared per-IP budget across
// EVERY prefix it's mounted on — not a separate budget per prefix. `controlLimiter`'s
// 10/min is shared across its 5 mounts (/api/cast/seed, /api/castd, /api/memory,
// /api/budget, /api/cast/worktrees); `destructiveLimiter`'s 5/min across its 5
// (/api/control, /api/cast/exec, /api/cast/task-queue, /api/cast/memories,
// /api/sessions); `cheapReadLimiter`'s 10/min across its 3 (/api/agents, /api/rules,
// /api/hook-events). Verified empirically (security__u3bi-final probe): 6 POSTs to
// /api/agents followed by 6 POSTs to /api/hook-events produced
// {agents: 6×404, hookevents: 4×404, hookevents: 2×429} — the last two throttled
// purely by budget already spent on an unrelated prefix, not by hook-events traffic.
// Practical consequence: concurrent legitimate writes across two features sharing an
// instance (e.g. a roster edit via /api/agents and a rules edit via /api/rules) can
// 429 sooner than a per-prefix reading of the mount comments below would suggest.
// This sharing is the existing convention here (controlLimiter/destructiveLimiter
// already worked this way before cheapReadLimiter existed) — do not "fix" it by
// splitting any of these into one instance per prefix; that would loosen the
// DASHBOARD_TOKEN brute-force bound (spreading one 5-or-10/min budget across 5
// separate per-prefix buckets instead of one shared one).
const controlLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// Tighter limiter for destructive control endpoints (rollback, dispatch)
const destructiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

// For prefixes whose GET side is a cheap, frequently-polled read (not a token-gated
// write): `controlGate` never checks DASHBOARD_TOKEN on GET/HEAD/OPTIONS — it next()s
// SAFE_METHODS immediately (see controlGate.ts) — so a token brute-force guess MUST be
// a non-GET. Skipping SAFE_METHODS here costs nothing on brute-force resistance (the
// write path below is still throttled) while letting ordinary reads through unlimited.
// Mounted on /api/agents, /api/rules, /api/hook-events — see each mount below for why
// that prefix's GET traffic specifically needs this. Do NOT generalize this `skip` to
// /api/cast/worktrees (its GET spawns a `git` subprocess per request — throttling GET
// there IS the S4 fix) or /api/memory (its GET side is cheap but its gated POST sits
// behind a 15s execSync, and this instance is dedicated to the cheap-GET prefixes only —
// mounting it there too would blur that distinction for no benefit).
const cheapReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: (req) => SAFE_METHODS.has(req.method),
})

// Rate limiters are mounted BEFORE the controlGate loop below, DELIBERATELY — do not
// "fix" this by moving them after the gate. Reasoning (S7, re-litigated and confirmed
// empirically after an earlier revision of this comment got it backwards):
//   - `express-rate-limit` here has no custom `keyGenerator`, so buckets are per-IP.
//     A remote attacker guessing DASHBOARD_TOKEN never shares the operator's bucket —
//     the operator's own quota can only be burned by a request from the operator's own
//     IP, which (combined with the loopback-only default bind) means a process that has
//     already compromised the machine. That "lockout" risk is not a real threat model.
//   - Mounting the limiter BEFORE controlGate means invalid-token guesses against a
//     gated prefix get throttled to `max` per window and then 429, same as any other
//     write. Moving the limiter AFTER controlGate lets controlGate's 403 (which fires
//     before the limiter ever runs) reject every guess for free — an attacker can then
//     brute-force DASHBOARD_TOKEN indefinitely with unlimited 403s and no 429 ever
//     appears. Verified empirically: 25 bad-token POSTs at a gated prefix produced
//     {403:10, 429:15} with the limiter before the gate, vs {403:25} (unthrottled) with
//     it after. See server/__tests__/rateLimitOrdering.test.ts for the regression test.
//   - ASSUMPTION this reasoning depends on: the server sees each client's REAL IP.
//     There is no reverse proxy in front of this dashboard today. If one is ever added
//     and it either doesn't forward the client IP or isn't configured as a trusted
//     `trust proxy` hop, every external client collapses into one apparent IP — all
//     remote traffic then shares one bucket, and the "operator lockout" risk this
//     comment currently dismisses becomes real again. Revisit this ordering if that
//     changes.
//   - Every GATED_PREFIXES entry needs a limiter mounted here — a gated prefix with
//     none is unthrottled against token brute-forcing regardless of mount order,
//     because there's no limiter in the chain at all to order (this is how
//     /api/agents, /api/rules and /api/hook-events shipped originally: gated but
//     limiter-less).
app.use('/api/cast/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)
app.use('/api/cast/exec', destructiveLimiter)
app.use('/api/castd', controlLimiter)
// Tighter limit for task-queue and memories DELETEs (destructive, match exec/control)
app.use('/api/cast/task-queue', destructiveLimiter)
app.use('/api/cast/memories', destructiveLimiter)
// gated but previously had no limiter at all — see /backup-trigger's execSync
app.use('/api/memory', controlLimiter)
// gated, human-driven file writes (POST/PUT under ~/.claude); GET is a cheap file/roster
// read hit by multiple independent consumers with no cross-query dedup — useAgents.ts
// (GET /api/agents, GET /api/agents/:name per name), useAgentRoster.ts (GET
// /api/agents/roster), DocsView.tsx (GET /api/agents). SystemView's AgentDetailInline
// fetches /api/agents/:name per agent on expansion, and with 27 agents on disk and no
// staleTime on that query, expanding ~11 of them inside a minute would hit a shared,
// GET-counting 10/min budget during ordinary browsing — cheapReadLimiter avoids that.
app.use('/api/agents', cheapReadLimiter)
// gated, human-driven file writes (PUT under ~/.claude); GET (useKnowledge.ts) is a
// cheap file read — same reasoning as /api/agents above.
app.use('/api/rules', cheapReadLimiter)
// gated. The route comment in hookEvents.ts describes an as-yet-unwired capability
// (Claude Code hooks POSTing here directly) — grepped the flagship's scripts/*.sh,
// scripts/*.py and ~/.claude/settings.json and found no live producer, so there is no
// real ingest-volume constraint today to size the WRITE side's limiter against. When a
// producer is wired (tracked as Unit 8 / finding V-A+F4), revisit that ceiling against
// actual traffic — 10/min will likely be too tight once something is really posting
// hook events here. Uses cheapReadLimiter (not controlLimiter) because its GET side
// (GET /recent, GET /stream) is a cheap in-memory ring-buffer read, and useHookEvents.ts's
// SSE client auto-reconnects to GET /stream every 3s on error — a real outage or network
// blip would otherwise burn the budget in well under a minute and prevent the stream
// from recovering, right when a user would want it to. Note this is cheapReadLimiter's
// SHARED budget (with /api/agents and /api/rules, not a dedicated hook-events-only
// 10/min) — see the shared-budget note above `const controlLimiter` for why that's
// deliberate and not something to split apart.
app.use('/api/hook-events', cheapReadLimiter)
// sessions DELETE is a soft-destructive write; budget POST/DELETE is a config write
app.use('/api/sessions', destructiveLimiter)
app.use('/api/budget', controlLimiter)
// public GET, not in GATED_PREFIXES (controlGate never touches it either way), but it
// spawns a `git` subprocess per request even after the S4 async fix — a limiter here
// caps how many subprocesses an unauthenticated flood can pile up.
app.use('/api/cast/worktrees', controlLimiter)
// `/api/constellation` limiter deleted: it had one but no route ever existed behind it
// (grep confirms zero definitions in server/ or src/).

// Opt-in write gate: reads always pass; writes require CAST_DASHBOARD_CONTROL=1
// plus a matching X-Dashboard-Token. Mounted on EVERY state-changing surface:
//   /api/control, /api/castd, /api/cast/exec   — original gates (dispatch/kill/rollback)
//   /api/cast/seed                              — DB bulk-write
//   /api/budget                                 — budget DELETE+INSERT
//   /api/cast/task-queue                        — DELETE rows
//   /api/cast/memories                          — DELETE rows (149-row live table)
//   /api/memory                                 — backup-trigger execSync
//   /api/agents                                 — POST/PUT file writes under ~/.claude
//   /api/rules                                  — PUT file writes under ~/.claude
//   /api/hook-events                            — ingest (write) path
//   /api/sessions                               — soft-delete (DELETE sets deleted_at)
// Driven from GATED_PREFIXES (single source of truth in controlGate.ts) so this
// list and the one defaultDenyGate checks below cannot drift apart.
for (const prefix of GATED_PREFIXES) {
  app.use(prefix, controlGate)
}

// Default-deny net: any non-GET request whose path isn't covered by one of the
// GATED_PREFIXES mounts above 404s here, BEFORE it can reach the main router.
// This is the fix for how S1 (`/api/test-broadcast`) shipped ungated — a new
// router with a mutating route is now unreachable-by-default rather than
// unprotected-by-default. Must be mounted here: after the explicit controlGate
// mounts (so gated paths pass through untouched) and before `app.use('/api',
// router)` (a request the router already handled never reaches middleware
// mounted after it).
app.use(defaultDenyGate)

app.use('/api', router)

// SSE attaches the /api/events route + starts file watchers. Skipped under test.
if (!process.env.VITEST) {
  attachSSE(app)
}

// Unmatched /api/* routes fall through to here as a JSON 404 — mounted right after the
// router so an unknown API path never reaches the SPA fallback below.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Serve the built SPA. `npm run build` emits the compiled server into
// dist/server/index.js alongside the client bundle at dist/index.html, so the client
// build is always the parent of this file's directory at runtime. Skipped under test
// (matching the other runtime-only wiring above) and tolerant of a missing dist/ —
// `npm run dev` serves the SPA from Vite on :5173 and never produces one.
//
// IMPORTANT: the repo root ships its own (Vite source) index.html. Under `npm run dev`
// (tsx running server/index.ts directly, VITEST unset), `import.meta.url` points at
// server/index.ts, so the naive parent-of-this-file resolution lands on the REPO ROOT —
// whose index.html would satisfy an existsSync check and mount `express.static()` on the
// entire repository. The `path.basename(distDir) === 'dist'` check below is what actually
// distinguishes a real compiled build (dist/server/index.js -> distDir = <repo>/dist) from
// that false positive (server/index.ts -> distDir = <repo>, basename = repo dir name, not
// 'dist') — do not remove it even though `!process.env.VITEST` looks sufficient on its own.
if (!process.env.VITEST) {
  const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const indexHtmlPath = path.join(distDir, 'index.html')
  if (path.basename(distDir) === 'dist' && fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir))
    // SPA history fallback — only for non-API GETs, so /api/* keeps returning the
    // JSON 404 above instead of being swallowed by the fallback here.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(indexHtmlPath)
    })
  }
}

// Global error handler — must be last middleware
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  const status = (err as { status?: number }).status ?? 500
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${status}: ${message}`)
  if (!res.headersSent) {
    // Don't leak raw 5xx error text (which can include absolute paths / internals) to the
    // client; log it server-side only. 4xx carry deliberate validation messages, so keep those.
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : message })
  }
})

// Runtime startup — skipped under test (process.env.VITEST is set by vitest) so the
// module can be imported for integration tests without creating directories under the
// real $HOME, starting watchers, or binding a port.
if (!process.env.VITEST) {
  const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost'])
  if (!LOOPBACK_HOSTS.has(HOST)) {
    console.warn(`
⚠️  DASHBOARD_HOST=${HOST} binds this server to a non-loopback interface.
⚠️  Every GET route is unauthenticated by design — anything reachable on that
⚠️  network can now read:
⚠️    - full session transcripts (all projects under ~/.claude/projects)
⚠️    - the entire cast.db, including via /api/cast/explore/:table
⚠️    - ~/.claude/settings.json and ~/.claude/settings.local.json
⚠️    - agent memory (~/.claude/agent-memory-local)
⚠️    - ~/.claude/plans
⚠️  Only set DASHBOARD_HOST to a non-loopback address if you understand and
⚠️  accept that exposure.
`)
  }

  // Note only — not validation, not a block. A short DASHBOARD_TOKEN is easier to
  // guess against the write surfaces controlGate protects. 16 characters is the bar
  // (e.g. `openssl rand -hex 8` produces exactly 16 hex characters / 64 bits of
  // entropy) — below it, warn; an existing shorter token still keeps working.
  if (isControlEnabled()) {
    const token = process.env.DASHBOARD_TOKEN ?? ''
    if (token.length > 0 && token.length < 16) {
      console.warn(`
⚠️  DASHBOARD_TOKEN is shorter than 16 characters, making it easier to guess against
⚠️  the write surfaces controlGate protects (dispatch, kill, rollback, DB writes).
⚠️  Consider a longer, randomly generated token, e.g. \`openssl rand -hex 16\`.
`)
    }
  }

  app.listen(PORT, HOST, () => {
    console.log(`Claude Dashboard server on ${HOST}:${PORT}`)

    // Warn loudly if cast.db has drifted from the columns the routes expect.
    logSchemaDrift(getCastDb())
  })
}
