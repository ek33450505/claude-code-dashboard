# claude-code-dashboard

## Install
```bash
npm install
```

## Run
```bash
npm run dev        # Vite :5173 + Express :3001 concurrently
```

## Test
```bash
npm test           # Vitest run (non-watch)
```

## Non-obvious

- `cast.db` must exist at `~/.claude/cast.db` before first run — schema is owned by the flagship's `cast-db-init.sh` (`cast status` creates it). The dashboard NEVER creates or alters cast.db schema; seeding fails closed (503) if the DB is missing/uninitialized. `npm run seed` (or gated POST `/api/cast/seed`) backfills token/cost data from JSONL using canonical columns only.
- `PORT` env var overrides Express port (default 3001). Must also update Vite proxy in `vite.config.ts` to match.
- `CORS_ORIGIN` env var overrides allowed origin (default `http://localhost:5173`).
- `DASHBOARD_HOST` env var overrides the bind interface (default `127.0.0.1`, loopback-only). Every GET route is unauthenticated by design, so binding to a non-loopback address exposes session transcripts, all of `cast.db`, `~/.claude/settings.json`/`settings.local.json`, agent memory, and `~/.claude/plans` to anything on that network — the server logs a loud startup warning if `DASHBOARD_HOST` is set to anything other than `127.0.0.1`, `::1`, or `localhost`.
- `CAST_DASHBOARD_CONTROL=1` + `DASHBOARD_TOKEN=<string>` enable write/control endpoints. Dashboard is read-only by default — server startup performs zero DB writes, and ALL mutating endpoints (control, castd, cast/exec, seed, budget, task-queue, memories, memory, agents, rules, hook-events, session delete) sit behind the gate: non-GET fail-closed (disabled → 404, unconfigured → 503, bad token → 403, constant-time), GETs stay public.
- Server startup runs a schema-drift check (`server/utils/schemaGuard.ts`) that validates all referenced `cast.db` tables and columns exist and warns if schema has drifted. A contract test (`server/__tests__/schemaContract.test.ts`) asserts column presence.
- `docs/` contains planning artifacts (`LIVE_ACTIVITY_REDESIGN.md`, `superpowers/`) — not user-facing docs.
- Production: `npm run build` runs `vite build` THEN `tsc -p tsconfig.server.json`, in that order — Vite's `emptyOutDir` wipes `dist/` on every run, so the server compile step (which emits `dist/server/index.js` and `dist/shared/*.js`) must run second or its output gets deleted. `npm start` runs `node dist/server/index.js`, which serves the SPA (`dist/index.html` + static assets) via Express and falls through to a JSON 404 for unmatched `/api/*` routes.
- One cost source per surface: `agent_runs.cost_usd` for agent-scoped figures, JSONL `estimateCost` for whole-session totals — never both in one field/sum. See the policy block at the top of `shared/pricing.ts`. `SUM(cost_usd)` is a lower bound, not a total — some rows have NULL `cost_usd`; budget-status and executive-summary responses expose `runs_missing_cost` alongside their cost fields.
