![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![CI](https://github.com/ek33450505/claude-code-dashboard/actions/workflows/ci.yml/badge.svg)

**[CAST Live Demo →](https://cast-site-iota.vercel.app)** — See the full agent team this dashboard was built for.

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
- **CAST** (optional but recommended) -- installs the agents, hooks, and `cast.db` that power the full dashboard experience. Without CAST, session history and analytics views still work; dispatch history, hooks, and DB panels degrade gracefully.

---

## Quick Start

### 1. Install the Agent Team (recommended)

```bash
git clone https://github.com/ek33450505/claude-agent-team.git
cd claude-agent-team && bash install.sh
```

Installs 16 specialist agents, slash commands, skills, 4 enforcement hooks, and rules into `~/.claude/`.

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

## Views

| View | Route | What it shows |
|---|---|---|
| Home | `/` | Live system stats, current-month cost, CAST v3 architecture overview |
| Activity Monitor | `/activity` | Real-time SSE stream: chain-grouped agent feed, filter pills, active-agent sidebar (links to agent detail pages), task queue, cron status, token spend, agent run history; agent spawn timeline (`task_claimed` events) |
| Sessions | `/sessions` | Full session history with token counts, cost, model, duration; virtualized table; JSONL detail + markdown export; yellow "Compacted" badge on sessions with `context_compacted` events |
| Analytics | `/analytics` | 30-day token burn, model tier breakdown, delegation savings, tool frequency, per-agent scorecard; prompt volume bar chart (`user_prompt_submit` events) |
| Token Spend | `/token-spend` | Dedicated cost view from `cast.db`: daily spend chart, totals, input/output token breakdown |
| Hook Health | `/hooks` | Hook status table: existence, executable bit, last-fired timestamp |
| Dispatch History | `/dispatch-log` | Filterable dispatch event history from `cast.db agent_runs`; dispatch frequency charts |
| Plans | `/plans` | Browser for `~/.claude/plans/`; plans with a JSON dispatch manifest show a run button |
| Agents | `/agents` | Full agent registry: 2 model tiers (Sonnet/Haiku), tool count, memory files; inline editing and new agent form |
| System | `/system` | Hook table, system health stats, cron status (with CRUD), slash commands, agent configuration; Morning Briefing and Weekly Report cards with generate buttons |
| Memory Browser | `/memory` | Searchable agent and project memory files sourced from `cast.db`, `agent-memory-local/`, and legacy project memory paths; filterable by type (user, feedback, project, reference); last-modified timestamps on cards; inline edit/delete; backup status widget with manual trigger |
| Privacy | `/privacy` | Traffic-light summary from `audit.jsonl`: cloud vs. local call ratio, redacted calls, violation count |
| Knowledge Base | `/knowledge` | 14-category explorer of `~/.claude/`: memory, rules, plans, skills, commands, settings, outputs, dispatch, hooks, scripts, plugins, keybindings, tasks, debug |
| DB Explorer | `/db` | Read-only paginated browser for seven `cast.db` tables: sessions, agent_runs, task_queue, agent_memories, routing_events, budgets, mismatch_signals; type-aware cells, search, copy-row, row counts in sidebar |

Global search is available via `Cmd+K` -- searches sessions, agents, plans, and memories with keyboard navigation.

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
                                                     │   logs/audit     │
                                                     │     .jsonl       │ ← privacy audit log
                                                     │   cast.db        │ ← structured run history
                                                     └──────────────────┘
```

The Express server owns all `~/.claude/` I/O. The React SPA never touches the filesystem directly -- it fetches from the API and subscribes to the SSE stream. TanStack Query handles caching, stale-while-revalidate, and background refetch. Each route is wrapped in an `ErrorBoundary` so a broken view never crashes the rest of the app.

`castDbWatcher` polls `cast.db` every 3 seconds and, when new rows are detected in `agent_runs`, `sessions`, or `routing_events`, immediately pushes `db_change_agent_run`, `db_change_session`, and `db_change_routing_event` events over the `/api/events` SSE stream. The React SPA subscribes to this stream and uses the incoming events to invalidate the relevant TanStack Query caches on the spot, so the UI reflects new data without waiting on background poll intervals or manual refresh.

On server startup, a fire-and-forget POST to `/api/cast/seed` backfills token data from existing JSONL files into `cast.db` without blocking the process.

---

## How It Connects to CAST

The dashboard is a read layer over what CAST writes. No CAST-specific code is required in the dashboard -- it just reads the files.

| File / Resource | Written by | Read by |
|---|---|---|
| `~/.claude/cast.db` | CAST hooks (cost-tracker, agent-stop) | Dispatch History, Activity, Analytics, Token Spend, DB Explorer |
| `~/.claude/cast.db` (`agent_memories` table) | CAST memory-router hook | Memory Browser (primary structured source) |
| `~/.claude/agent-memory-local/*/` | CAST agents (markdown files) | Memory Browser (secondary flat-file source) |
| `~/.claude/projects/*/` | Claude Code session runner | Sessions, Activity Monitor |
| `~/.claude/logs/audit.jsonl` | Claude Code | Privacy view |
| `~/.claude/agents/`, `plans/`, etc. | CAST install + user | Agents, Plans, Knowledge Base |
| `~/.claude/settings.json` | Claude Code + CAST | Hook Health, System |

Install CAST first for the full picture. The dashboard degrades gracefully if CAST is absent -- session history and analytics still work from raw JSONL.

---

## CAST v3 Architecture

CAST v3 uses **model-driven dispatch** -- `CLAUDE.md` contains a dispatch table that the model reads to decide which agent to call. No routing scripts, no regex patterns.

| Concept | Details |
|---|---|
| **Agents** | 16 specialists across 2 model tiers |
| **Sonnet tier** (11) | code-writer, debugger, planner, security, merge, researcher, docs, bash-specialist, orchestrator, morning-briefing, devops |
| **Haiku tier** (4) | code-reviewer, commit, push, test-runner |
| **Hooks** | 4 enforcement hooks (PreToolUse:Bash, PostToolUse:Write/Edit, PostToolUse:Agent, Stop) |
| **Observability** | `cast.db` SQLite: agent_runs, sessions, budgets, task_queue, agent_memories, routing_events |
| **Scheduling** | Cron-based (replaces the v2 castd daemon) |
| **Post-chain** | After code changes: code-reviewer -> commit -> push |

### CAST v3.1 Integration

Version 1.1.0 of the dashboard surfaces four hook events written by CAST into `cast.db routing_events`:

| Event | Surfaced in |
|---|---|
| `task_claimed` | Activity page agent spawn timeline |
| `user_prompt_submit` | Analytics page prompt volume bar chart |
| `context_compacted` | Sessions page "Compacted" badge |
| `task_completed` | Activity page agent run history |

These events require CAST v3.1 or later. The dashboard degrades gracefully if the events are absent.

---

## Environment / Config

No `.env` file is required for local development. The server reads `~/.claude/` using the `HOME` environment variable.

| Variable | Default | Purpose |
|---|---|---|
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for the Express CORS header |

To change the API port, update `PORT` in `server/constants.ts` and the Vite proxy config in `vite.config.ts`.

---

## API Reference

### Agents

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/agents/:name` | PUT | Update agent frontmatter fields |
| `/api/agents` | POST | Create a new agent definition |
| `/api/agents/live` | GET | Currently running subagents |

### Sessions

| Endpoint | Method | Description |
|---|---|---|
| `/api/sessions` | GET | Session list with summary stats (supports `?project=` and `?limit=`) |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/sessions/:project/:id/export` | GET | Session as markdown export |
| `/api/sessions/:project/:id` | DELETE | Delete a session |
| `/api/active` | GET | Sessions modified in the last 5 minutes |

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

### Analytics

| Endpoint | Method | Description |
|---|---|---|
| `/api/analytics` | GET | Cross-session token/cost aggregates |
| `/api/analytics/profile` | GET | Per-agent scorecard from `cast.db` |
| `/api/analytics/profile/:agent` | GET | Single-agent drill-down |

### Dispatch and Hooks

| Endpoint | Method | Description |
|---|---|---|
| `/api/hooks/health` | GET | Hook health: existence, executable bit, last fired |
| `/api/hooks` | GET | Hook definitions from settings files |
| `/api/hook-events` | POST | HTTP hook receiver — accepts Claude Code hook payloads and broadcasts as `hook_event` SSE events |
| `/api/routing/events` | GET | Dispatch event log from `cast.db`; supports `?event_type=<type>` filter |
| `/api/routing/event-types` | GET | Distinct event types present in `cast.db` |
| `/api/routing/stats` | GET | Aggregate dispatch statistics |

### Control

| Endpoint | Method | Description |
|---|---|---|
| `/api/control/dispatch` | POST | Spawn a CAST agent directly via `child_process.spawn`; tracked in `cast.db task_queue` |
| `/api/control/queue` | GET | Current task queue sorted by `queuedAt` |
| `/api/control/weekly-report` | POST | Run `cast-weekly-report.sh` and return output |

### Scheduler

| Endpoint | Method | Description |
|---|---|---|
| `/api/castd/status` | GET | Cron job status: CAST-related crontab entries |

### Privacy

| Endpoint | Method | Description |
|---|---|---|
| `/api/privacy` | GET | Traffic-light summary from `audit.jsonl` |
| `/api/privacy/audit` | GET | Raw audit log entries |

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
| `/api/scripts` | GET | Shell scripts in `~/.claude/` |
| `/api/plugins` | GET | Plugin definitions |
| `/api/keybindings` | GET | Custom keybinding contexts |
| `/api/tasks` | GET | Active task directories with lock status |
| `/api/debug` | GET | Debug log entries |
| `/api/permissions` | GET | Permission settings |
| `/api/launch` | GET | Launch configuration |
| `/api/outputs/:category` | GET | Briefings, meetings, reports, or email-summaries |
| `/api/search?q=` | GET | Global search across sessions, agents, plans, memories |
| `/api/budget` | GET | Budget status from `cast.db` |

### Real-time

| Endpoint | Method | Description |
|---|---|---|
| `/api/events` | SSE | Real-time session and agent activity stream (exponential backoff reconnect); includes `db_change_agent_run`, `db_change_session`, and `db_change_routing_event` push events from `castDbWatcher` (polls cast.db every 3s) |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| UI Components | Lucide React, cmdk (Cmd+K palette), sonner (toasts) |
| Charts | Recharts |
| Routing | React Router v6, React.lazy code splitting, per-route ErrorBoundary |
| State | TanStack Query v5, TanStack Virtual (virtualized lists) |
| Backend | Express 5, chokidar (file watching), tsx |
| Database | better-sqlite3 (`cast.db` -- sessions, agent runs, task queue) |
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

CAST (Claude Agent Specialist Team) is the companion system this dashboard observes. It installs hook scripts, agent definitions, and slash commands into `~/.claude/`. Four hooks fire on Claude Code interactions -- enforcing code review after edits, blocking raw git commits, tracking agent dispatch costs, and logging session completions.

The dashboard reads what CAST writes: `cast.db`, the agent definition files, and the hook configurations. Install CAST first for the full picture; the dashboard degrades gracefully if CAST is not present.

[CAST on GitHub](https://github.com/ek33450505/claude-agent-team)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
