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
- `docs/` contains planning artifacts (`LIVE_ACTIVITY_REDESIGN.md`, `superpowers/`) — not user-facing docs.
- Production: `npm run build` (tsc + vite), then `npm start` serves `dist/server/index.js`. Static assets served by Express from `dist/`.
