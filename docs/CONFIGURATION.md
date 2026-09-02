# Configuration Reference

The dashboard runs with zero configuration in its default state — it's designed for local development. Environment variables control the server port, CORS, and optional write-access gating.

## Quick Start

```bash
npm install
npm run dev    # Vite :5173 + Express :3001 concurrently
```

No environment setup is required. The server binds to `127.0.0.1:3001` (loopback-only) and connects to `~/.claude/cast.db` automatically.

## Environment Variables

| Variable | Default | Purpose | Source |
|---|---|---|---|
| `PORT` | `3001` | Express server port | `server/constants.ts:39` |
| `DASHBOARD_HOST` | `127.0.0.1` | Bind interface (loopback-only by default) | `server/constants.ts:40` |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (Vite dev server) | `server/constants.ts:46` |
| `CAST_REPO_DIR` | `~/Projects/personal/claude-agent-team` | CAST flagship repo root (for `git worktree` introspection) | `server/constants.ts:33` |
| `CAST_BIN` | `$CAST_REPO_DIR/bin/cast` | Path to `cast` CLI binary | `server/constants.ts:37` |
| `CAST_REPO_PATH` | `~/Projects/personal/claude-agent-team` | Deprecated alias for `CAST_REPO_DIR`; use `CAST_REPO_DIR` instead | `server/constants.ts:39-42` |
| `CAST_DB_PATH` | `~/.claude/cast.db` | Cast database path (overrides default) | `server/constants.ts:30` |
| `CLAUDE_PATH` | `claude` | Path to Claude CLI binary | `server/routes/control.ts:87` |
| `CAST_DASHBOARD_CONTROL` | unset (disabled) | Opt-in write-surface gating (`'1'` to enable) | `server/middleware/controlGate.ts:42` |
| `DASHBOARD_TOKEN` | unset | Authentication token for write operations (required if `CAST_DASHBOARD_CONTROL=1`) | `server/middleware/controlGate.ts:47` |

### Environment Variable Notes

**Database location:** The server reads `CAST_DB_PATH` from the environment and defaults to `~/.claude/cast.db` if unset. The database location is fully overridable.

**CAST_REPO_DIR vs CAST_REPO_PATH:** Both are resolved in `server/constants.ts` (see line 39) with precedence: `CAST_REPO_DIR` takes precedence if both are set; if neither is set, the default is `~/Projects/personal/claude-agent-team`. `CAST_REPO_PATH` is kept as a deprecated alias for backward compatibility. Use `CAST_REPO_DIR` for new configurations.

## Enabling the Write Surface

By default, the dashboard is **read-only**. All GET routes (analytics, logs, queues) are accessible without authentication. Write operations are disabled.

To enable write access (dispatch, kill, rollback, plan execution, DB mutations):

```bash
export CAST_DASHBOARD_CONTROL=1
export DASHBOARD_TOKEN="$(openssl rand -hex 16)"  # 32-char hex, 128 bits
```

Pass the token in the `x-dashboard-token` request header:

```bash
# Successful write (token matches)
curl -X POST http://localhost:3001/api/control/dispatch \
  -H "Content-Type: application/json" \
  -H "x-dashboard-token: YOUR_TOKEN_HERE" \
  -d '{"agentType":"backend-writer","prompt":"Fix the bug"}'
# 200 OK

# Control surface disabled (CAST_DASHBOARD_CONTROL not set)
curl -X POST http://localhost:3001/api/control/dispatch \
  -H "x-dashboard-token: YOUR_TOKEN_HERE" \
  -d '{"agentType":"backend-writer","prompt":"Fix the bug"}'
# 404 Not found

# Control surface enabled but no token configured
export CAST_DASHBOARD_CONTROL=1
curl -X POST http://localhost:3001/api/control/dispatch \
  -H "x-dashboard-token: YOUR_TOKEN_HERE" \
  -d '{"agentType":"backend-writer","prompt":"Fix the bug"}'
# 503 Service Unavailable (error: Control surface enabled but DASHBOARD_TOKEN is not configured)

# Bad or missing token (with control surface enabled and token configured)
curl -X POST http://localhost:3001/api/control/dispatch \
  -H "x-dashboard-token: WRONG_TOKEN" \
  -d '{"agentType":"backend-writer","prompt":"Fix the bug"}'
# 403 Forbidden (constant-time comparison)
```

### Gated Endpoints

Write-access gating protects these prefixes:

- `/api/control` — dispatch, kill, rollback
- `/api/castd` — daemon management
- `/api/cast/exec` — arbitrary CLI execution
- `/api/cast/seed` — bulk DB write
- `/api/budget` — budget configuration
- `/api/cast/task-queue` — task deletion
- `/api/cast/memories` — memory deletion
- `/api/memory` — backup/sync operations
- `/api/agents` — agent roster file writes
- `/api/rules` — knowledge/rules file writes
- `/api/hook-events` — event ingest
- `/api/sessions` — session deletion

All read-only methods (GET, HEAD, OPTIONS) on these endpoints always pass authentication.

## Rate Limiting

All write-surface prefixes are rate-limited to prevent brute-force and abuse. Three limiters are in effect:

| Limiter | Limit | Window | Prefixes |
|---|---|---|---|
| `controlLimiter` | 10 requests | 60 seconds | `/api/cast/seed`, `/api/castd`, `/api/memory`, `/api/budget`, `/api/cast/worktrees` |
| `destructiveLimiter` | 5 requests | 60 seconds | `/api/control`, `/api/cast/exec`, `/api/cast/task-queue`, `/api/cast/memories`, `/api/sessions` |
| `cheapReadLimiter` | 10 POST/PUT | 60 seconds | `/api/agents`, `/api/rules`, `/api/hook-events` (GET/HEAD/OPTIONS exempt) |

**Important:** Each limiter instance shares one per-IP budget across ALL its mounted prefixes. For example, `controlLimiter`'s 10/min quota is shared across 5 different prefixes — concurrent legitimate writes to `/api/agents` and `/api/rules` can throttle each other because they both draw from the same shared pool.

The `cheapReadLimiter` exempts read-only methods (GET/HEAD/OPTIONS) to allow frequent polling of cheap data (agent roster, rules files, hook-event streams) without counting toward the write quota.

Limiters are mounted BEFORE the authentication gate to ensure token-guessing attempts are throttled uniformly — see `server/index.ts:100–127` for the threat model.

## Security

### Loopback-Only Binding

By default, the server binds to `127.0.0.1:3001`, accessible ONLY from the local machine. This is safe because every GET route is **unauthenticated**.

If you set `DASHBOARD_HOST` to a non-loopback address (e.g., `0.0.0.0`, `192.168.x.x`), the server logs a loud warning at startup:

```
⚠️  DASHBOARD_HOST=0.0.0.0 binds this server to a non-loopback interface.
⚠️  Every GET route is unauthenticated by design — anything reachable on that
⚠️  network can now read:
⚠️    - full session transcripts (all projects under ~/.claude/projects)
⚠️    - the entire cast.db, including via /api/cast/explore/:table
⚠️    - ~/.claude/settings.json and ~/.claude/settings.local.json
⚠️    - agent memory (~/.claude/agent-memory-local)
⚠️    - ~/.claude/plans
```

Only set `DASHBOARD_HOST` to a non-loopback address if you understand and accept that exposure — typically for a VPN-only or private-network deployment.

### Token Requirements

If `CAST_DASHBOARD_CONTROL=1` is set but `DASHBOARD_TOKEN` is not, write endpoints return 503 (Service Unavailable) rather than running unauthenticated.

The server warns if `DASHBOARD_TOKEN` is shorter than 16 characters (64 bits of entropy). A short token is easier to brute-force against the rate-limited write surfaces.

```bash
# Recommended: 16+ character hex string
openssl rand -hex 16   # Produces 32-char hex string
```

## Known Caveats

**Paths in returned content are not redacted.** The dashboard redacts the operator's home directory and username from path *fields* it constructs (session keys, transcript paths, SSE payloads — see `server/utils/projectKey.ts`). It does NOT rewrite paths that appear inside producer-authored *content* it merely displays: agent memory bodies (`/api/cast/memories`), incident descriptions (`/api/incidents`), agent work logs (`/api/work-log-stream`), and exported session transcripts. Those reproduce what an agent actually wrote, including absolute paths. Since every GET route is unauthenticated by design, treat the whole surface as sensitive and keep the server bound to loopback (the default).

## See Also

- **[API Reference](./API.md)** — Detailed endpoint documentation
- **[README](../README.md)** — Project overview and quick start
