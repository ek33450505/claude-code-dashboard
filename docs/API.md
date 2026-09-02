# API Reference

The Claude Code Dashboard API is a read-only-by-default local HTTP surface over `~/.claude` and `cast.db`, served by Express on `127.0.0.1:3001` by default. The API has 103 endpoints across read-only observability, write-gated control, and real-time streaming.

## Conventions

### Base URL & Configuration

All endpoints are rooted at `http://127.0.0.1:3001/api` (default).

| Environment Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Express server port |
| `DASHBOARD_HOST` | `127.0.0.1` | Bind interface; can be set to `::1` (IPv6) or `localhost`. **Warning:** binding to a non-loopback address exposes all routes publicly (session transcripts, `cast.db`, `~/.claude/` files). Server logs a startup warning if `DASHBOARD_HOST` is not loopback-only. |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (Vite dev server default). |

### Write Gate (Control Surface)

The API is **read-only by default**. Any state-changing request (POST, PUT, DELETE on a gated prefix) is refused unless the operator has explicitly opted in.

**Requirements for write access:**
- `CAST_DASHBOARD_CONTROL=1` (environment variable)
- `DASHBOARD_TOKEN=<string>` (environment variable, shared across all write endpoints)
- `x-dashboard-token: <string>` header on the request

**Gated prefixes** (12 total):
```
/api/control
/api/castd
/api/cast/exec
/api/cast/seed
/api/budget
/api/cast/task-queue
/api/cast/memories
/api/memory
/api/agents
/api/rules
/api/hook-events
/api/sessions
```

**Fail-closed semantics** for non-GET requests on a gated prefix:
- **Disabled** (`CAST_DASHBOARD_CONTROL != '1'`) → `404 Not Found`
- **Enabled but unconfigured** (no `DASHBOARD_TOKEN`) → `503 Service Unavailable`
- **Bad or missing token** → `403 Forbidden` (constant-time comparison, no timing leak)
- **Valid token** → request proceeds

**Read-only verbs always pass:** GET, HEAD, OPTIONS requests on any prefix (gated or not) are never checked for a token and never 404'd due to being gated.

### Rate Limiting

Rate limiters are mounted and shared across prefixes. A single limiter's budget applies to all prefixes it covers.

| Limiter | Limit | Window | Prefixes |
|---|---|---|---|
| `controlLimiter` | 10/min | per IP | `/api/cast/seed`, `/api/castd`, `/api/memory`, `/api/budget`, `/api/cast/worktrees` |
| `destructiveLimiter` | 5/min | per IP | `/api/control`, `/api/cast/exec`, `/api/cast/task-queue`, `/api/cast/memories`, `/api/sessions` |
| `cheapReadLimiter` | 10/min | per IP (writes only) | `/api/agents` (GETs exempt), `/api/rules` (GETs exempt), `/api/hook-events` (GETs exempt) |

**Note:** Each `rateLimit()` instance shares a per-IP budget across every prefix it's mounted on. Concurrent writes across two prefixes sharing one instance (e.g., roster edit via `/api/agents` and rules edit via `/api/rules`) can hit 429 sooner than prefix-specific reading suggests.

### Empty-Envelope Convention

When a cast.db table list route is queried:
- If cast.db is unopened, missing, or uninitialized → returns HTTP `200` with an empty envelope
- If the requested table doesn't exist → returns HTTP `200` with an empty envelope
- These routes **never** return `404` or `500` for missing DB/table states

This is deliberate. Callers should not treat an empty array as an error; check your `cast.db` schema with `sqlite3 ~/.claude/cast.db .tables` if results are unexpectedly empty.

### Pagination: `limit` & `offset`

Routes that support list pagination use `limit` and `offset` query parameters, clamped by `clampLimit()` and `clampOffset()`.

**Clamping rules:**
- Absent, non-numeric, zero, or negative `limit` → `defaultValue` (route-specific, typically 20–50)
- Fractional `limit` → floored to integer
- `limit` > `max` → capped at `max`
- Absent, non-numeric, or negative `offset` → `0`
- Fractional `offset` → floored to integer
- `offset` > `max` → capped at `max`

Example: `GET /api/sessions?limit=-5&offset=2.7` clamps to the default limit and offset 2.

---

## Endpoints

### Sessions

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/sessions` | List all sessions with caching fallback to cast.db | `project` (filter by project), `limit` (default 50, max 500) |
| `GET` | `/sessions/:projectEncoded/:sessionId` | Fetch a single session by ID | — |
| `GET` | `/sessions/:projectEncoded/:sessionId/export` | Export session transcript as JSON | — |
| `DELETE` | `/sessions/:projectEncoded/:sessionId` | Soft-delete a session (gated) | — |

### Agent Runs & Active Agents

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/cast/active-agents` | List only currently running agents (status='running' within last 15 minutes) | — |
| `GET` | `/cast/active-agents/:sessionId` | Active agents for a specific session | — |
| `GET` | `/cast/agent-runs` | List all agent runs from cast.db | `limit`, `offset` |
| `GET` | `/cast/agent-runs/:sessionId` | Agent runs for a specific session | `limit`, `offset` |
| `GET` | `/cast/session-agents` | Deduplicated agent status per session | `limit`, `offset` |
| `GET` | `/cast/session-agents/:sessionId` | Agent history for a specific session | `limit`, `offset` |
| `GET` | `/cast/worktrees` | List worktree status from cast.db (spawns `git` subprocess, rate-limited) | `limit`, `offset` |
| `GET` | `/cast/worktrees/:sessionId` | Worktree status for a specific session | — |

### Agents & Roster

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/agents` | List all agent definitions (gated read, cheap GET rate-limit) | — |
| `GET` | `/agents/:name` | Fetch a single agent definition by name | — |
| `GET` | `/agents/roster` | List agent roster metadata | — |
| `POST` | `/agents` | Create or update an agent definition (gated) | — |
| `PUT` | `/agents/:name` | Update a specific agent definition (gated) | — |

### Cost & Budget

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/cast/cost-summary` | Aggregated cost data for the System page pricing widget | `days` (default 30, max 365), `top` (default 10, max 50) |
| `GET` | `/budget/status` | Current budget config and usage | — |
| `POST` | `/budget/config` | Update budget configuration (gated) | — |

### CAST Record & Exploration

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/cast/plans` | List all plan files from `~/.claude/plans` | `limit`, `offset` |
| `GET` | `/cast/token-spend` | Aggregate token spend data from JSONL | `days` (default 30, max 365) |
| `GET` | `/cast/tool-failures` | List tool failure events from cast.db | `limit`, `offset` |
| `GET` | `/cast/tool-failures/stats` | Summary stats for tool failures | — |
| `GET` | `/cast/explore/tables` | List all cast.db table names | — |
| `GET` | `/cast/explore/:table` | Fetch rows from a cast.db table by name (browser-safe) | `limit` (default 50, max 500), `offset` |
| `GET` | `/cast/research-cache/stats` | Research cache hit rate and stats | — |
| `POST` | `/cast/seed` | Backfill token/cost data from JSONL (gated) | — |
| `GET` | `/cast/task-queue` | List queued tasks from cast.db | `limit`, `offset` |
| `DELETE` | `/cast/task-queue/:id` | Delete a queued task (gated) | — |
| `GET` | `/cast/memories` | List agent memory objects (gated read, cheaper rate-limit) | `limit`, `offset` |
| `DELETE` | `/cast/memories/:id` | Delete an agent memory entry (gated) | — |

### Analytics & Quality Gates

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/analytics` | Aggregate analytics: session count, agent run stats | — |
| `GET` | `/analytics/profile` | Per-agent analytics breakdown | — |
| `GET` | `/analytics/profile/:agent` | Analytics for a specific agent | — |
| `GET` | `/executive-summary` | High-level system health: cost, run counts, error rates | — |
| `GET` | `/dispatch-decisions` | Quality gate decisions from cast.db | `limit`, `offset` |
| `GET` | `/dispatch-decisions/stats` | Summary of quality gate outcomes | — |
| `GET` | `/quality-gates` | Synonym for dispatch-decisions | `limit`, `offset` |
| `GET` | `/quality-gates/stats` | Synonym for dispatch-decisions/stats | — |
| `GET` | `/agent-hallucinations` | Hallucination detection results from cast.db | `limit`, `offset` |
| `GET` | `/agent-hallucinations/stats` | Hallucination summary stats | — |

### Control & Dispatch (Gated)

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/control/queue` | List command queue (reads always pass) | — |
| `POST` | `/control/dispatch` | Spawn a new agent (gated) | — |
| `POST` | `/control/kill/:sessionId` | Terminate a running session (gated) | — |
| `POST` | `/control/rollback` | Rollback an agent run (gated) | — |
| `POST` | `/control/batch/:chainId/approve` | Approve a batch operation (gated) | — |
| `POST` | `/control/batch/:chainId/reject` | Reject a batch operation (gated) | — |
| `POST` | `/control/weekly-report` | Generate a weekly status report (gated) | — |
| `POST` | `/cast/exec` | Execute a plan (gated, destructiveLimiter) | — |
| `GET` | `/cast/exec/:plan_id/status` | Check execution status of a plan | — |

### castd (Cron Management)

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/castd/status` | Current castd daemon status (reads always pass) | — |
| `POST` | `/castd/cron` | Create or update a cron job (gated) | — |
| `DELETE` | `/castd/cron` | Delete a cron job (gated) | — |
| `POST` | `/castd/trigger` | Manually trigger a cron job (gated) | — |

### Memory Management

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/memory/agent` | List all agent memory directories | — |
| `GET` | `/memory/agent/:agentName` | List memory files for a specific agent | — |
| `PUT` | `/memory/agent/:agentName/:filename` | Update a memory file (gated) | — |
| `DELETE` | `/memory/agent/:agentName/:filename` | Delete a memory file (gated) | — |
| `GET` | `/memory/project` | List project-level memory entries | — |
| `GET` | `/memory/db-memories` | List memories stored in cast.db | `limit`, `offset` |
| `GET` | `/memory/backup-status` | Status of agent memory backups | — |
| `POST` | `/memory/backup-trigger` | Trigger a memory backup (gated, includes execSync) | — |
| `GET` | `/memory-consolidation` | Memory consolidation status | — |

### Config & Knowledge Base

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/config` | Dashboard system overview (version, directory counts) | — |
| `GET` | `/config/health` | Server health and readiness check | — |
| `GET` | `/config/agent-groups` | Configured agent group definitions | — |
| `GET` | `/config/chain-map` | Chain/workflow configuration | — |
| `GET` | `/config/control` | Control surface configuration (gated status, token set?) | — |
| `GET` | `/config/model-pricing` | Pricing configuration for LLM models | — |
| `GET` | `/config/policies` | CAST policies loaded from `~/.claude/config/policies.json` | — |
| `GET` | `/config/settings` | Global settings from `~/.claude/settings.json` | — |
| `GET` | `/config/settings-local` | Local overrides from `~/.claude/settings.local.json` | — |

### Rules, Skills & Hooks

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/rules` | List rule files from `~/.claude/rules` (gated read) | — |
| `GET` | `/rules/:filename` | Fetch a single rule file | — |
| `PUT` | `/rules/:filename` | Update a rule file (gated) | — |
| `GET` | `/skills` | List registered skills | — |
| `GET` | `/skills/:name` | Fetch a single skill definition | — |
| `GET` | `/commands` | List dashboard commands | — |
| `GET` | `/commands/:name` | Fetch a single command definition | — |
| `GET` | `/hooks` | List Claude Code hook definitions | — |
| `GET` | `/hooks/health` | Hook health status (exists, executable, recent failures) | — |

### Routing & Hook Events

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/routing/event-types` | List hook event types | — |
| `GET` | `/routing/events` | List routing events (all hook dispatches) | `limit`, `offset` |
| `GET` | `/routing/stats` | Routing summary stats | — |
| `GET` | `/hook-events/recent` | Recent hook events (reads always pass) | — |
| `GET` | `/hook-events/stream` | Hook events SSE stream | — |
| `POST` | `/hook-events` | Post a hook event (gated, currently no live producers) | — |
| `GET` | `/hook-failures` | List hook execution failures | `limit`, `offset` |
| `GET` | `/hook-failures/count` | Count of hook failures | — |

### System & Search

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/system/integrity` | System integrity check (DB schema, file presence) | — |
| `GET` | `/search` | Search sessions, agents, plans, memories | `q` (query, min 2 chars), `limit` (default 20, max 100) |
| `GET` | `/outputs/:category` | Fetch outputs by category | — |

### Work Log & Streaming

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/work-log-stream` | Real-time work log of agent executions | — |
| `GET` | `/work-log-stream/:agentRunId` | Work log entries for a specific agent run | — |

### Agents & Telemetry

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/agent-protocol-violations` | Agent protocol violations detected | `limit`, `offset` |
| `GET` | `/stop-failure-events` | SubagentStop hook failures | `limit`, `offset` |
| `GET` | `/completeness-events` | Completeness gate events | `limit`, `offset` |
| `GET` | `/completeness-events/stats` | Summary of completeness gate outcomes | — |

### Plans

| Method | Path | Description | Query Parameters |
|---|---|---|---|
| `GET` | `/plans` | List all plan files | `limit`, `offset` |
| `GET` | `/plans/:filename` | Fetch a single plan file | — |
| `GET` | `/plans/sessions` | List plans grouped by session | — |

---

## Real-Time Streaming: `/api/events`

**Method:** `GET`  
**Streaming Protocol:** Server-Sent Events (SSE)  
**Authentication:** Public (not gated, not rate-limited)  
**Content-Type:** `text/event-stream`

Real-time stream of work-log events as agents execute. Clients connect via:

```javascript
const eventSource = new EventSource('http://127.0.0.1:3001/api/events')
eventSource.onmessage = (evt) => {
  const data = JSON.parse(evt.data)
  // { timestamp, agent_run_id, event_type, message, ... }
}
```

The stream is always open. On network error, the client should reconnect. The server keeps old events in an in-memory ring buffer; new clients receive recent history.

---

## Notes

- This API reference is hand-maintained and should be updated alongside route changes in `server/routes/index.ts` (the main router mount table) and individual route files.
- All timestamps in responses use ISO 8601 format or Unix timestamps (unixepoch); see specific route docs if ambiguous.
- Error responses always include an `error` field with a message string.
- The dashboard is intentionally read-only by default to prevent accidental state mutations. The write gate is opt-in via environment variables.
