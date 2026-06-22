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

- `cast.db` must exist at `~/.claude/cast.db` before first run. Run `cast status` to create it, or run `npm run seed` to backfill from existing JSONL. Dashboard shows empty state without it.
- `PORT` env var overrides Express port (default 3001). Must also update Vite proxy in `vite.config.ts` to match.
- `CORS_ORIGIN` env var overrides allowed origin (default `http://localhost:5173`).
- `CAST_DASHBOARD_CONTROL=1` + `DASHBOARD_TOKEN=<string>` enable write/control endpoints (dispatch, cron mutations). Dashboard is read-only by default; control endpoints require both flags + header auth. Gating is constant-time and fail-closed (disabled → 404, unconfigured → 503, bad token → 403).
- Server startup runs a schema-drift check (`server/utils/schemaGuard.ts`) that validates all referenced `cast.db` tables and columns exist and warns if schema has drifted. A contract test (`server/__tests__/schemaContract.test.ts`) asserts column presence.
- `docs/` contains planning artifacts (`LIVE_ACTIVITY_REDESIGN.md`, `superpowers/`) — not user-facing docs.
- Production: `npm run build` (tsc + vite), then `npm start` serves `dist/server/index.js`. Static assets served by Express from `dist/`.
