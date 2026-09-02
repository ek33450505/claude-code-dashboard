# Architecture

Orientation for a first-time reader of this codebase. For the full endpoint and
environment-variable inventories, see [`docs/API.md`](./API.md) and
[`docs/CONFIGURATION.md`](./CONFIGURATION.md) — this document does not duplicate them.

## What this is

`claude-code-dashboard` is a **read-only observability UI** over Claude Code's local
state. It reads, but never writes the schema of:

- session JSONL transcripts under `~/.claude/projects/`
- the CAST SQLite database at `~/.claude/cast.db`
- `~/.claude/settings.json` / `settings.local.json`
- agent memory (`~/.claude/agent-memory-local`)
- plans (`~/.claude/plans`)

`cast.db`'s schema is owned by the CAST flagship's `cast-db-init.sh` — this dashboard
never creates or alters it. `server/utils/schemaGuard.ts` validates the tables/columns
routes depend on (`EXPECTED_SCHEMA`) against the live DB at startup and logs a warning
on drift; `server/__tests__/schemaContract.test.ts` asserts the same contract in CI.
Seeding (`npm run seed`, or the gated `POST /api/cast/seed`) backfills token/cost data
into `cast.db` from JSONL using canonical columns only, and fails closed (503) if the
database is missing or uninitialized.

## Process / runtime shape

- **Dev:** `npm run dev` runs `concurrently` over `server:dev` (`tsx watch server/index.ts`,
  Express on `:3001`) and `vite` (`:5173`).
- **Build:** `npm run build` runs `vite build && tsc -p tsconfig.server.json`, **in that
  order**. Vite's `emptyOutDir` wipes `dist/` on every run, so the server compile step
  (which emits `dist/server/index.js` and `dist/shared/*.js`) must run second, or its
  output gets deleted by the next `vite build`.
- **Prod:** `npm start` runs `node dist/server/index.js`. That process serves the built
  SPA (`dist/index.html` + static assets) via `express.static` with a history-API
  fallback, and falls through to a JSON `{ "error": "Not found" }` 404 for any unmatched
  `/api/*` path (`server/index.ts:210-212`).

## Server layout

```
server/
  index.ts        Express app assembly: security headers, CORS, rate limiters,
                   controlGate mounts, the router, SSE, static SPA serving, error handler
  constants.ts     Path/env constants (CLAUDE_DIR, CAST_DB, PORT, HOST, CORS_ORIGIN, ...)
  routes/          One file per API resource (46 .ts files) — agents, sessions, memory,
                   plans, config, control, agentRuns, taskQueue, evalRuns, ...
  middleware/       controlGate.ts — the write-surface auth gate (see below)
  parsers/          File parsers for ~/.claude/ data: sessions.ts, agents.ts, rules.ts,
                     skills.ts, commands.ts, memory.ts, workLog.ts, projectPath.ts
  watchers/         sse.ts (the /api/events live feed + tail-following), castDbWatcher.ts
  utils/            schemaGuard.ts, projectKey.ts, relativizeHome.ts, clampLimit.ts,
                     makeTableRouter.ts, tableExists.ts, taskSummary.ts, safeResolve.ts,
                     jsonlTokenTotals.ts
  __tests__/        46 test files (route/middleware/watcher integration tests)
```

**Request path:** `server/index.ts` builds the Express `app`, applies `helmet`
(CSP intentionally off — see the comment in `index.ts`, since the bundled SPA's chart/
animation libraries set inline styles) and CORS headers, mounts per-prefix rate
limiters, then loops `GATED_PREFIXES` to mount `controlGate` on every write surface,
then mounts `defaultDenyGate` (a default-deny net for any non-GET path not covered by
a gated prefix), and only then mounts the resource router at `app.use('/api', router)`.
`server/routes/index.ts` wires each resource's router (`agentsRouter`, `sessionsRouter`,
`memoryRouter`, `controlRouter`, `agentRunsRouter`, etc.) onto its `/api/...` prefix;
most routes call `getCastDb()` (`server/routes/castDb.ts`) to query `cast.db`.

## Security model

- **Read-only by default.** Server startup performs zero DB writes.
- **Loopback-only bind.** `DASHBOARD_HOST` defaults to `127.0.0.1`; if set to anything
  other than `127.0.0.1`, `::1`, or `localhost`, `server/index.ts` prints a loud startup
  warning (`index.ts:257-271`) — because every GET route is unauthenticated by design,
  binding wider exposes session transcripts, all of `cast.db` (including via
  `/api/cast/explore/:table`), settings files, agent memory, and plans to anything on
  that network.
- **Gated writes.** `CAST_DASHBOARD_CONTROL=1` plus a matching `X-Dashboard-Token`
  header (`DASHBOARD_TOKEN` env var) unlock the mutating endpoints. The gate
  (`server/middleware/controlGate.ts`) is mounted per-prefix from a single source of
  truth, `GATED_PREFIXES` — currently `/api/control`, `/api/castd`, `/api/cast/exec`,
  `/api/cast/seed`, `/api/budget`, `/api/cast/task-queue`, `/api/cast/memories`,
  `/api/memory`, `/api/agents`, `/api/rules`, `/api/hook-events`, `/api/sessions`.
  Behavior is fail-closed: disabled → 404 (hides the endpoint's existence),
  enabled-but-unconfigured (no `DASHBOARD_TOKEN`) → 503, bad/absent token → 403 via a
  constant-time compare (`crypto.timingSafeEqual`). Read verbs (`GET`/`HEAD`/`OPTIONS`)
  always pass the gate.
- **Default-deny net.** `defaultDenyGate` (also in `controlGate.ts`) is mounted right
  after the `GATED_PREFIXES` loop and before the main router: any non-GET request whose
  path isn't covered by one of those prefixes 404s there instead of reaching a route
  handler. This closes the gap where a new router shipping a mutating route without
  being added to `GATED_PREFIXES` would otherwise run ungated.
- **Per-IP rate limiting.** Several `express-rate-limit` instances are mounted in
  `server/index.ts` ahead of the `controlGate` mounts (deliberately — so invalid-token
  guesses get throttled rather than free-403'd before ever reaching a limiter). Each
  limiter instance shares one budget across every prefix it's mounted on; see the
  extensive comments in `server/index.ts:45-171` before changing any of this.

## Data-integrity conventions

A newcomer will otherwise violate these; both are enforced by convention, not by a
lint rule, so read them before adding a route.

- **One cost source per surface.** `agent_runs.cost_usd` (written by CAST's own
  `cast_subagent_stop.py`) is the agent-scoped source — used for budget status,
  executive summary, per-agent analytics, and agent-run lists/stats. JSONL via
  `shared/pricing.ts`'s `estimateCost` is the whole-session source, including non-agent
  turns — used only for whole-session totals (session views, `jsonlTokenTotals.ts`).
  Never mix the two into a single field or sum: `SUM(cost_usd)` is a lower bound, not a
  total, because some rows have a NULL `cost_usd`; responses that expose a `cost_usd`
  sum also expose `runs_missing_cost` alongside it. See the policy block at the top of
  `shared/pricing.ts`.
- **Path redaction at the response boundary.** `server/utils/projectKey.ts`'s
  `redactPath()` is the standard redaction for any filesystem path returned to a
  client. It composes `relativizeHome()` (strips a leading `$HOME` prefix) with
  `maskProjectKey()` (masks the encoded `-Users-<user>-...` project-directory segment,
  which can appear mid-string, e.g. inside a JSONL path under
  `~/.claude/projects/<encoded>/`). Never apply `redactPath()` to a value still used
  for filesystem access afterward — `fs` does not expand `~`.
- **Schema drift guard.** `server/utils/schemaGuard.ts` (`EXPECTED_SCHEMA`,
  `verifySchema`, `logSchemaDrift`) validates that every table/column a route depends
  on still exists in `cast.db` at startup; `server/__tests__/schemaContract.test.ts`
  asserts the same contract.
- **Shared helpers, to avoid re-deriving the same logic per route:**
  - `taskSummarySubquery()` — `server/utils/taskSummary.ts`
  - `clampLimit()` / `clampOffset()` — `server/utils/clampLimit.ts`
  - `makeTableRouter()` — `server/utils/makeTableRouter.ts`
  - `tableExists()` — `server/utils/tableExists.ts`

## Frontend layout

```
src/
  App.tsx         Route table (react-router-dom), lazy-loaded views, legacy redirects
  main.tsx        Entry point
  api/            TanStack Query hooks, one per resource (useAgents.ts, useSessions.ts,
                   useCastData.ts, useLive.ts, ...) plus apiFetch.ts
  views/          Top-level page components (36 .tsx files) — HomeView, SessionsView,
                   AnalyticsView, SystemView, AgentsView, WorkLogView, ...
  components/     Shared UI (Layout, Sidebar, StatCard, WorkLogFeed, ...) plus
                   analytics/, effects/, ui/ subdirectories
  state/          Client-side state (sseState.ts, themeState.tsx)
  lib/            controlFetch.ts (token-aware fetch for gated writes), motion.ts,
                   useChartColors.ts, useModalA11y.ts, utils.ts
  utils/          localAgents.ts, modelBadge.ts
  types/          Shared TypeScript types
```

`shared/` (outside `src/` and `server/`, imported by both) holds `castSchema.ts`,
`pricing.ts`, `time.ts`, and `format.ts` — code that must produce identical results on
client and server.

The live feed on `/api/events` is a Server-Sent Events stream registered directly on
`app` inside `server/watchers/sse.ts`'s `attachSSE()` — called from `server/index.ts`,
**not** part of the `server/routes/index.ts` mount table. Any endpoint count taken by
scanning that mount table will miss it. The frontend consumes it via `src/api/useLive.ts`.

## Testing

Tests live alongside source: `Foo.tsx` → `Foo.test.tsx` under `src/`, and
`server/__tests__/*.test.ts` for the server. Framework is Vitest
(`npm test` = `vitest run`, `npm run test:watch` for watch mode) with React Testing
Library for components — prefer `getByRole`/`getByText` over `getByTestId`.
