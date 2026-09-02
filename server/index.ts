import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { PORT, DASHBOARD_COMMANDS_DIR } from './constants.js'
import { router } from './routes/index.js'
import { controlGate } from './middleware/controlGate.js'
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

const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173'
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin)
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Dashboard-Token')
  next()
})
app.options(/.*/, (_req, res) => res.sendStatus(204))

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

app.use('/api/cast/seed', controlLimiter)
app.use('/api/control', destructiveLimiter)
app.use('/api/cast/exec', destructiveLimiter)
app.use('/api/castd', controlLimiter)
app.use('/api/constellation', controlLimiter)
// Tighter limit for task-queue and memories DELETEs (destructive, match exec/control)
app.use('/api/cast/task-queue', destructiveLimiter)
app.use('/api/cast/memories', destructiveLimiter)
// sessions DELETE is a soft-destructive write; budget POST/DELETE is a config write
app.use('/api/sessions', destructiveLimiter)
app.use('/api/budget', controlLimiter)

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
app.use('/api/control', controlGate)
app.use('/api/castd', controlGate)
app.use('/api/cast/exec', controlGate)
app.use('/api/cast/seed', controlGate)
app.use('/api/budget', controlGate)
app.use('/api/cast/task-queue', controlGate)
app.use('/api/cast/memories', controlGate)
app.use('/api/memory', controlGate)
app.use('/api/agents', controlGate)
app.use('/api/rules', controlGate)
app.use('/api/hook-events', controlGate)
app.use('/api/sessions', controlGate)

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
  app.listen(PORT, () => {
    console.log(`Claude Dashboard server on :${PORT}`)

    // Warn loudly if cast.db has drifted from the columns the routes expect.
    logSchemaDrift(getCastDb())
  })
}
