<!-- <p align="center">
  <img src="docs/cast-banner.png" alt="CAST — A local-first multi-agent framework for Claude Code" />
</p> -->

![Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![CI](https://github.com/ek33450505/claude-code-dashboard/actions/workflows/ci.yml/badge.svg)

**[CAST](https://castframework.dev)** — See the full agent team this dashboard was built for.

# Claude Code Dashboard

**Observability UI for the CAST Local-First AI Agent OS**

See every agent dispatch, session, hook status, and token cost -- live and historically -- without leaving your browser.

---

Running Claude Code with specialist agents is powerful but opaque. Which agents fired? What did they cost? Are the hooks actually working? Which sessions are burning budget on Sonnet when Haiku would have sufficed?

The dashboard answers all of that. It reads `~/.claude/` directly and streams live session data via SSE -- no accounts, no telemetry, no external services. It is the observability layer for [CAST](https://github.com/ek33450505/claude-agent-team), the model-driven agent dispatch system that runs alongside Claude Code.

---

## Prerequisites

- **Node.js 18+**
- **A `~/.claude/` directory** -- present with any Claude Code installation
- **macOS or Linux**
- **CAST** (optional but recommended) -- installs the agents, hooks, and `cast.db` that power the full dashboard experience. Without CAST, session history and analytics views still work; hooks and DB panels degrade gracefully.

---

## Quick Start

### 1. Install the Agent Team (recommended)

```bash
git clone https://github.com/ek33450505/claude-agent-team.git
cd claude-agent-team && bash install.sh
```

Installs 30 specialist agents, slash commands, skills, 4 enforcement hooks, and rules into `~/.claude/`.

### 2. Start the Dashboard

```bash
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard
npm install
npm run dev
```

React frontend at [http://localhost:5173](http://localhost:5173). Express API on port 3001.

### 3. Open Claude Code

Hooks are active immediately. Open any Claude Code session -- the model reads `CLAUDE.md` to dispatch agents, and the dashboard streams activity in real time.

---

## Pages

Six pages cover the full observability surface.

| Page | Route | What it shows |
|---|---|---|
| Dashboard | `/` | Live overview: active agents, today's cost, recent runs, system health |
| Sessions | `/sessions`, `/sessions/:project/:sessionId` | Full session history with token counts, cost, model, duration; JSONL detail drill-down; "Compacted" badge on sessions with `context_compacted` events |
| Analytics | `/analytics`, `/analytics/agents/:agent` | 30-day token burn, model tier breakdown, delegation savings, tool frequency, per-agent scorecard with drill-down |
| Swarm | `/swarm` | Active and past CAST Agent Team swarm sessions; teammate roles, task status, token spend per teammate |
| Agents | `/agents` | Agent registry, live status, scorecard, run history with filters |
| System | `/system` | Tabbed browser: Agents, Rules, Skills, Hooks, Memory, Plans, DB, Cron |

Global search is available via `Cmd+K` -- searches sessions, agents, plans, and memories with keyboard navigation.

### Swarm Page

The Swarm page (`/swarm`) visualizes CAST Agent Teams — parallel agent groups working on coordinated tasks.

| Component | What it shows |
|---|---|
| SwarmCard | Team name, status, teammate count, elapsed time, total token spend (aggregated across all teammates) |
| TeammateRow | Per-role breakdown: agent definition, current task, status, individual token spend |
| MessageFeed | Timestamped log of all teammate messages: task assignments, status updates, completion events |
| TokenChart | Horizontal bar chart showing tokens_in + tokens_out per teammate role (Recharts visualization) |

All data is read from `swarm_sessions`, `teammate_runs`, and `teammate_messages` tables in `cast.db`. Polls every 5 seconds via TanStack Query for live updates.

### Agents Page

The Agents page (`/agents`) consolidates agent registry and run history into a single view.

**Agent Registry (card grid):**
- All agents displayed as sortable cards with name, model tier, description
- Active agents highlighted with emerald border
- Search by agent name or description
- Click agent card to drill into recent runs

**Active Agents Strip:**
- Compact horizontal list of currently running agents
- Shows model tier badge and elapsed time
- Real-time updates via SSE

**Scorecard (sortable table):**
- Total runs, success rate, average cost, last run timestamp
- Sort by any column (agent name, runs, success rate, cost, last run)
- Click to filter recent runs by agent

**Recent Runs (with filters):**
- Last 50 agent runs with timestamps, status, duration, token spend
- Filter by agent and status (DONE, DONE_WITH_CONCERNS, BLOCKED, NEEDS_CONTEXT)
- Hover for full task description

### System Tabs

The System page consolidates all configuration and tooling views into a single tabbed interface:

| Tab | What it shows |
|---|---|
| Agents | Full agent registry: model tiers, tool count, memory files; inline editing and new agent form |
| Rules | Rule file browser with previews |
| Skills | Skill definitions with metadata |
| Hooks | Hook status: existence, executable bit, last-fired timestamp; definitions from settings files |
| Memory | Searchable agent and project memory files; filterable by type; inline edit/delete; backup status widget |
| Plans | Plan browser with JSON dispatch manifest detection and run button |
| DB | Read-only paginated browser for `cast.db` tables: sessions, agent_runs, task_queue, agent_memories, routing_events, budgets, mismatch_signals, swarm_sessions, teammate_runs, teammate_messages |
| Cron | CAST-related crontab entries with CRUD |

---

## Architecture

```
                                                     ┌──────────────────┐
┌──────────────────┐     SSE (real-time)             │                  │
│                  │◀────────────────────────────────│   Express 5 API  │
│   React 19 SPA   │     REST (on demand)            │   Port 3001      │
│   Vite 6 + HMR   │◀────────────────────────────────│                  │
│   Port 5173      │     PUT/POST (editing)          │   chokidar watch │
│                  │────────────────────────────────▶│   JSONL parsing  │
│   TanStack Query │                                 │   gray-matter    │
│   React Router   │                                 │   better-sqlite3 │
│   Tailwind v4    │                                 └────────┬─────────┘
└──────────────────┘                                          │ reads/writes
                                                              ▼
                                                     ┌──────────────────┐
                                                     │   ~/.claude/     │
                                                     │                  │
                                                     │   projects/      │ ← session JSONL logs
                                                     │   agents/        │ ← agent definitions (r/w)
                                                     │   agent-memory-  │
                                                     │     local/       │ ← agent memories (r/w, flat-file)
                                                     │   commands/      │ ← slash commands
                                                     │   skills/        │ ← skill definitions
                                                     │   rules/         │ ← rule files
                                                     │   plans/         │ ← implementation plans
                                                     │   settings.json  │ ← configuration + hooks
                                                     │   settings.local │
                                                     │     .json        │ ← local overrides + hooks
                                                     │   cast.db        │ ← structured run history
                                                     └──────────────────┘
```

The Express server owns all `~/.claude/` I/O. The React SPA never touches the filesystem directly -- it fetches from the API and subscribes to the SSE stream. TanStack Query handles caching, stale-while-revalidate, and background refetch. Each route is wrapped in an `ErrorBoundary` so a broken view never crashes the rest of the app.

`castDbWatcher` polls `cast.db` every 3 seconds and pushes `db_change_agent_run`, `db_change_session`, and `db_change_routing_event` events over the `/api/events` SSE stream when new rows arrive. The React SPA subscribes to this stream and uses incoming events to invalidate TanStack Query caches immediately -- no polling intervals, no manual refresh.

On server startup, a fire-and-forget POST to `/api/cast/seed` backfills token data from existing JSONL files into `cast.db` without blocking the process.

---

## How It Connects to CAST

The dashboard is a read layer over what CAST writes. No CAST-specific code is required in the dashboard -- it just reads the files and database tables.

| File / Resource | Written by | Read by |
|---|---|---|
| `~/.claude/cast.db` (core tables) | CAST hooks (cost-tracker, agent-stop) | Dashboard, Sessions, Analytics, System (DB tab) |
| `~/.claude/cast.db` (`agent_memories` table) | CAST memory-router hook | System (Memory tab) |
| `~/.claude/cast.db` (`swarm_sessions`, `teammate_runs`, `teammate_messages` tables) | CAST Agent Teams hooks | Swarm page, System (DB tab) |
| `~/.claude/cast.db` (`agent_runs` table) | CAST agent-stop hook | Agents page, Analytics |
| `~/.claude/agent-memory-local/*/` | CAST agents (markdown files) | System (Memory tab) |
| `~/.claude/projects/*/` | Claude Code session runner | Sessions, Dashboard |
| `~/.claude/agents/`, `plans/`, etc. | CAST install + user | System (Agents, Plans tabs) |
| `~/.claude/settings.json` | Claude Code + CAST | System (Hooks tab) |

Install CAST first for the full picture. The dashboard degrades gracefully if CAST is absent -- session history and analytics still work from raw JSONL. To see swarm and agent run data, CAST v4.6+ with Agent Teams integration is required.

---

## CAST v4.6 Architecture

CAST uses **model-driven dispatch** -- `CLAUDE.md` contains a dispatch table that the model reads to decide which agent to call. No routing scripts, no regex patterns.

| Concept | Details |
|---|---|
| **Agents** | 30 specialists across 2 model tiers (Sonnet, Haiku) + Opus |
| **Model tiers** | Sonnet for complex analysis, Haiku for lightweight/review tasks, Opus for long-context synthesis |
| **Hooks** | Quality gates: PostToolUse:Agent (code-reviewer auto-dispatch), PreToolUse:Bash (guard), cost-tracker, agent-stop (observability) |
| **Agent Teams** | `/swarm` skill spawns parallel agents with quality gates and isolated worktrees; hooks track teammate lifecycle |
| **Observability** | `cast.db` SQLite: agent_runs, sessions, budgets, task_queue, agent_memories, routing_events, swarm_sessions, teammate_runs, teammate_messages |
| **Scheduling** | Cron-based |
| **Post-chain** | After code changes: code-reviewer -> commit -> push |

---

## Environment / Config

No `.env` file is required for local development. The server reads `~/.claude/` using the `HOME` environment variable.

| Variable | Default | Purpose |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for the Express CORS header |

To change the API port, update `PORT` in `server/constants.ts` and the Vite proxy config in `vite.config.ts`.

---

## API Reference

### Sessions

| Endpoint | Method | Description |
|---|---|---|
| `/api/sessions` | GET | Session list with summary stats (supports `?project=` and `?limit=`) |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/sessions/:project/:id/export` | GET | Session as markdown export |
| `/api/sessions/:project/:id` | DELETE | Delete a session |

### Agents

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/agents/:name` | PUT | Update agent frontmatter fields |
| `/api/agents` | POST | Create a new agent definition |
| `/api/agents/live` | GET | Currently running subagents |

### CAST / cast.db

| Endpoint | Method | Description |
|---|---|---|
| `/api/cast/token-spend` | GET | 30-day token/cost data from `cast.db` |
| `/api/cast/agent-runs` | GET | Agent run history from `cast.db` |
| `/api/cast/task-queue` | GET | Current task queue from `cast.db` |
| `/api/cast/memories` | GET | Agent memories from `cast.db` |
| `/api/cast/explore/tables` | GET | List allowed tables in `cast.db` |
| `/api/cast/explore/:table` | GET | Paginated read of a `cast.db` table |
| `/api/cast/seed` | POST | Backfill token data from JSONL into `cast.db` |
| `/api/cast/plans` | GET | Plans with manifest detection |

### Swarm

| Endpoint | Method | Description |
|---|---|---|
| `/api/swarm/sessions` | GET | List of all swarm sessions (active and past), ordered by started_at DESC |
| `/api/swarm/sessions/:id` | GET | Single swarm session with all teammate_runs for that swarm_id |
| `/api/swarm/sessions/:id/messages` | GET | All teammate_messages for a swarm_id, ordered by timestamp DESC |


### Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/analytics` | GET | Cross-session token/cost aggregates |
| `/api/analytics/profile` | GET | Per-agent scorecard from `cast.db` |
| `/api/analytics/profile/:agent` | GET | Single-agent drill-down |

### Hooks and Routing

| Endpoint | Method | Description |
|---|---|---|
| `/api/hooks/health` | GET | Hook health: existence, executable bit, last fired |
| `/api/hooks` | GET | Hook definitions from settings files |
| `/api/hook-events` | POST | HTTP hook receiver -- accepts Claude Code hook payloads and broadcasts as `hook_event` SSE events |
| `/api/routing/events` | GET | Dispatch event log from `cast.db`; supports `?event_type=<type>` filter |
| `/api/routing/event-types` | GET | Distinct event types present in `cast.db` |
| `/api/routing/stats` | GET | Aggregate dispatch statistics |

### Control

| Endpoint | Method | Description |
|---|---|---|
| `/api/control/dispatch` | POST | Spawn a CAST agent directly via `child_process.spawn`; tracked in `cast.db task_queue` |
| `/api/control/queue` | GET | Current task queue sorted by `queuedAt` |
| `/api/control/weekly-report` | POST | Run `cast-weekly-report.sh` and return output |

### Config and Knowledge

| Endpoint | Method | Description |
|---|---|---|
| `/api/config/health` | GET | System health overview |
| `/api/memory` | GET | Project and agent memory files with `lastModified` timestamps |
| `/api/memory/backup-status` | GET | Last backup timestamp and log size |
| `/api/memory/backup-trigger` | POST | Run `cast-memory-backup.sh --dry-run` |
| `/api/plans` | GET | Implementation plan files |
| `/api/rules` | GET | Rule files with previews |
| `/api/skills` | GET | Skill definitions with metadata |
| `/api/commands` | GET | Slash commands |
| `/api/castd/status` | GET | Cron job status: CAST-related crontab entries |
| `/api/outputs/:category` | GET | Briefings, meetings, reports, or email-summaries |
| `/api/search?q=` | GET | Global search across sessions, agents, plans, memories |
| `/api/budget` | GET | Budget status from `cast.db` |

### Real-time

| Endpoint | Method | Description |
|---|---|---|
| `/api/events` | SSE | Real-time session and agent activity stream (exponential backoff reconnect); includes `db_change_agent_run`, `db_change_session`, and `db_change_routing_event` push events from `castDbWatcher` |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| UI Components | shadcn/ui, Lucide React, cmdk (Cmd+K palette), sonner (toasts) |
| Charts | Recharts, @nivo |
| Routing | React Router v6, React.lazy code splitting, per-route ErrorBoundary |
| State | TanStack Query v5, TanStack Virtual (virtualized lists) |
| Backend | Express 5, chokidar (file watching), tsx |
| Database | better-sqlite3 (`cast.db` -- sessions, agent runs, task queue, swarm sessions, teammate runs/messages) |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Testing | Vitest, React Testing Library |

---

## Development

```bash
npm run dev          # Start Express + Vite concurrently (API on :3001, UI on :5173)
npm run build        # Production build (tsc + vite)
npm run preview      # Serve the production build locally
npm test             # Run Vitest suite
```

---

## Local-First Design

Everything runs on your machine. No cloud, no telemetry, no external services.

- **Filesystem native** -- reads `~/.claude/` directly; agent definitions, memories, and configs are plain markdown and JSON
- **SQLite-backed** -- `cast.db` stores sessions, agent runs, task queue, memories, and budgets for structured queries
- **Human-editable** -- every config file is readable and editable outside the dashboard; nothing is locked in a database
- **No telemetry** -- no usage data sent anywhere; the server never phones home
- **No account required** -- no login, no API keys beyond what Claude Code already uses
- **Portable** -- `~/.claude/` is the source of truth; move it, back it up, version-control it

---

## About CAST

CAST (Claude Agent Specialist Team) is the companion framework this dashboard observes. It installs 30 specialist agents, hook scripts, slash commands, and quality gates into `~/.claude/`. Hooks fire on Claude Code interactions -- enforcing code review after edits, tracking dispatch costs, and logging session completions.

**v4.6 adds Agent Teams:** The `/swarm` skill lets you bootstrap parallel agent groups (frontend-dev + backend-dev + reviewer, for example) with isolated git worktrees and seeded identity/quality gate rules. The dashboard's new **Swarm page** shows team membership, task status, and token spend per teammate. The **Agents page** provides a comprehensive agent registry with live status, per-agent scorecard, and run history filters.

The dashboard reads what CAST writes: `cast.db` (agent runs, swarm sessions, teammate activity), agent definition files, and hook configurations. Install CAST v4.6+ for the full feature set; older versions still work for Sessions and Analytics.

[CAST on GitHub](https://github.com/ek33450505/claude-agent-team)

[CAST Framework (docs)](https://castframework.dev)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
