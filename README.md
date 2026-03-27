![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

# Claude Code Dashboard

**Observability UI for the CAST Local-First AI Agent OS**

See every agent dispatch, tool call, session, and routing decision — live and historically — without leaving your browser.

---

Running Claude Code with specialist agents is powerful but opaque. Which agents fired? What did they cost? What's in the task queue? How are routing decisions being made? And why did that session hit Sonnet three times when Haiku would have been fine?

The dashboard answers all of that. It reads `~/.claude/` directly and streams live session data via SSE — no accounts, no telemetry, no external services. It is the observability layer for [CAST](https://github.com/ek33450505/claude-agent-team), the hook-enforced agent routing system that runs alongside Claude Code.

---

## Quick Start

### 1. Install the Agent Team

```bash
git clone https://github.com/ek33450505/claude-agent-team.git
cd claude-agent-team && bash install.sh
```

Installs 42 agents, 32 slash commands, 12 skills, hooks, routing, and agent groups into `~/.claude/`.

### 2. Start the Dashboard

```bash
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard
npm install && npm run dev
```

React frontend at [http://localhost:5173](http://localhost:5173). Express API on port 3001.

### 3. Open Claude Code

Hooks are active immediately. Open any Claude Code session — routing fires on every prompt, the dashboard streams activity in real time.

### Requirements

- Node.js 18+
- `~/.claude/` directory (any Claude Code installation)
- macOS or Linux

The dashboard works standalone with any `~/.claude/` directory. The Agent Team adds the full CAST enforcement layer.

---

## The Dashboard

### Live Activity (`/activity`)

Real-time stream of everything Claude Code is doing right now.

- **Activity feed** — SSE stream of every tool call, write, dispatch, and status transition across all active sessions
- **Dispatch chain tree** — ordered steps for each active session, showing agent name, project badge, and status as it resolves
- **Agent cards** — per-agent status panel showing current activity parsed from `TodoWrite` in-progress items and last tool use
- **Task queue panel** — pending, claimed, done, and failed tasks from `cast.db`
- **Token spend sidebar** — live running cost for the current session burst

### Home (`/`)

Landing page with live system stats (agent count, session count, routing coverage), current-month cost summary, install instructions, and quick links to all views.

### Routing Log (`/routing`)

Filterable table of every routing decision from `routing-log.jsonl`. Charts show dispatch frequency by agent and match type over time. Filter by action, agent, or date range.

### Analytics (`/analytics`)

- 30-day daily token burn area chart
- Model tier breakdown: haiku vs. sonnet token share (pie chart + bar chart)
- Delegation savings panel — actual token cost delta from tier routing
- Tool call frequency charts
- Per-session cost tracking and current-month totals

### Token Spend (`/token-spend`)

Dedicated cost view backed by `cast.db`. Shows 30-day daily spend area chart, local vs. cloud token split, total input/output tokens, and session count — all from the structured sessions table rather than raw JSONL parsing.

### Sessions (`/sessions`)

Full session history with token counts, cost estimates, model used, and duration. Virtualized table handles large session counts. Delete sessions directly from the list. Session detail view shows the full JSONL event stream with tool call expansion and markdown export.

### Agents (`/agents`)

Categorized registry of all 42 agents across 6 tiers. Each card shows: model tier badge, routing status, tool count, description, and memory file count. Inline frontmatter editing and new agent creation from a form.

### System (`/system`)

Active hooks table pulled from `~/.claude/settings.local.json`. System health stats: agent count, command count, skill count, session count, plan count, rule count, and memory file counts. Routing stats: coverage rate, miss rate, and top dispatched agents with hook/auto/senior-dev badges.

**Daemon panel (castd)** — start/stop the CAST background daemon via `launchctl`, view live log tail, and see current queue depth — all without leaving the dashboard.

### Memory Browser (`/memory`)

Dedicated view for all agent and project memory files. Searchable, filterable by memory type (`user`, `feedback`, `project`, `reference`) with type badges, owner labels, and expandable content. Backed by `cast.db`'s `agent_memories` table when available, falling back to filesystem reads.

### Knowledge Base — CLAW (`/knowledge`)

14-category explorer covering the full `~/.claude/` directory:

| Category | Contents |
|----------|----------|
| Memory | Project and agent memory files with type badges |
| Rules | Rule files with previews |
| Plans | Implementation plan files |
| Skills | Skill definitions with metadata |
| Commands | Slash commands with agent routing |
| Routing | Active routing patterns and routing table |
| Hooks | Hook definitions from settings files |
| Scripts | Shell scripts in `~/.claude/` |
| Plugins | Plugin definitions |
| Keybindings | Custom keybinding contexts |
| Tasks | Active task directories with lock status |
| Debug | Debug log viewer |
| Settings | Parsed settings with secret masking |
| Outputs | Briefings, meetings, reports, and email summaries |

### DB Explorer (`/db`)

Read-only paginated table browser for `cast.db`. Exposes six tables: `sessions`, `agent_runs`, `task_queue`, `agent_memories`, `routing_events`, and `budgets`. Useful for ad-hoc inspection without a SQLite client.

### Global Search (`Cmd+K`)

Command palette searching across sessions, agents, plans, and memories. Categorized results with keyboard navigation.

---

## Feature Summary

| Feature | Description |
|---|---|
| Live Activity (SSE) | Real-time event stream of agent dispatches, tool calls, and routing decisions |
| Dispatch Chain Tree | Ordered step-by-step view of each session's agent chain with status resolution |
| 3-Stage Routing | Pattern match → NLU router → inline fallback, enforced before every prompt |
| Routing Log View | Filterable event table and dispatch charts from `routing-log.jsonl` |
| Agent Groups | 31 named compound workflows dispatching parallel agent waves |
| 11 Hook Directives | `[CAST-DISPATCH]`, `[CAST-CHAIN]`, `[CAST-REVIEW]`, `[CAST-HALT]`, `[CAST-DEBUG]`, and 6 more |
| Event Sourcing | Append-only `~/.claude/cast/events/` log — immutable dispatch record |
| Pre-Tool Guards | `git commit` and `git push` hard-blocked at OS level via exit 2 |
| Agent Memory Viewer | Searchable per-agent memory files with type badges, backed by `cast.db` |
| Analytics | 30-day token burn, model tier breakdown, delegation savings, per-session cost |
| Token Spend View | Dedicated cost dashboard from `cast.db` with local vs. cloud split |
| Knowledge Base (CLAW) | 14-category explorer covering the full `~/.claude/` directory |
| DB Explorer | Read-only paginated browser for `cast.db` (6 tables) |
| Daemon Control | Start/stop castd, view logs, check queue depth from the System page |
| Cost Tracking | Real-time haiku vs. sonnet spend with current-month totals |
| Global Search | Cmd+K command palette across sessions, agents, plans, and memories |
| Mobile Responsive | Full UI adapts to mobile viewport |

---

## How CAST Works

Four hooks fire before and after every Claude Code interaction:

```
UserPromptSubmit  →  route.sh               →  [CAST-DISPATCH]        →  specialist agent dispatched
UserPromptSubmit  →  route.sh               →  [CAST-DISPATCH-GROUP]  →  parallel agent group dispatched
PostToolUse       →  post-tool-hook.sh      →  [CAST-REVIEW]          →  code-reviewer auto-dispatched
PostToolUse       →  agent-status-reader.sh →  status tracking        →  BLOCKED surfaces immediately
PreToolUse        →  pre-tool-guard.sh      →  exit 2                 →  raw git commit/push blocked
Stop              →  prompt hook            →  safety net             →  catches unpushed commits
```

**`[CAST-DISPATCH]` and `[CAST-DISPATCH-GROUP]` (UserPromptSubmit → route.sh)**
Every prompt hits `route.sh` before Claude responds. The script matches against 28 routing patterns. Single-agent matches inject a `[CAST-DISPATCH]` directive; compound workflow matches inject `[CAST-DISPATCH-GROUP]`, which triggers one of 31 named parallel agent groups via wave-based dispatch.

**`[CAST-REVIEW]` (PostToolUse → post-tool-hook.sh)**
Every `Write` or `Edit` tool call triggers `post-tool-hook.sh`, which injects a `[CAST-REVIEW]` directive. Code review happens automatically, every time — using `code-reviewer` on haiku.

**Status tracking (PostToolUse → agent-status-reader.sh)**
`agent-status-reader.sh` parses structured Status blocks from completed agent output. `BLOCKED` halts the chain immediately and surfaces to the user. `DONE_WITH_CONCERNS` logs and continues.

**exit 2 block (PreToolUse → pre-tool-guard.sh)**
`git commit` and `git push` issued directly in Bash return exit code 2 — a hard block Claude cannot bypass. The only escape hatch is `CAST_COMMIT_AGENT=1 git commit`, which the `commit` agent uses internally.

### The 11 Hook Directives

Four are standing instructions defined in `CLAUDE.md`. Seven are injected at runtime by hook scripts:

| Directive | Source | Effect |
|-----------|--------|--------|
| `[CAST-DISPATCH]` | `route.sh` | Dispatch a single specialist agent |
| `[CAST-DISPATCH-GROUP]` | `route.sh` | Trigger a named parallel agent group |
| `[CAST-CHAIN]` | `post-tool-hook.sh` Part 2 | Sequential post-task agent chain (non-skippable) |
| `[CAST-REVIEW]` | `post-tool-hook.sh` Part 2 | Soft dispatch of `code-reviewer` |
| `[CAST-ORCHESTRATE]` | `post-tool-hook.sh` Part 3 | Plan file written — dispatch `orchestrator` |
| `[CAST-DEBUG]` | `post-tool-hook.sh` Part 5 | Bash non-zero exit — route to `debugger` |
| `[CAST-HALT]` | `agent-status-reader.sh` | Agent reported BLOCKED — hard-stop |
| `[CAST-NEEDS-CONTEXT]` | `agent-status-reader.sh` | Agent needs context — dispatch `researcher` |
| `[CAST-ESCALATE]` | `agent-status-reader.sh` | Third consecutive BLOCKED — suggest escalation |
| `[CAST-TIMEOUT]` | `agent-status-reader.sh` | 90+ min without commit — prompt checkpoint |
| `[CAST-DEPTH-WARN]` | `route.sh` (subagent) | Nesting depth >= 2 — inline session is fallback |

### The 42 Agents

Six tiers across 42 agents, organized by function:

| Tier | Agents |
|------|--------|
| **Core** (11) | planner, debugger, test-writer, code-reviewer, data-scientist, db-reader, commit, security, push, bash-specialist, router |
| **Extended** (8) | architect, tdd-guide, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, readme-writer, orchestrator |
| **Orchestration** (5) | auto-stager, chain-reporter, verifier, test-runner, linter |
| **Productivity** (5) | researcher, report-writer, meeting-notes, email-manager, morning-briefing |
| **Professional** (3) | browser, qa-reviewer, presenter |
| **Specialist** (10) | devops, performance, seo-content, code-writer, frontend-designer, framework-expert, pentest, infra, db-architect, merge |

Model dispatch: **Haiku** (fast, cheap) — commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader, report-writer, meeting-notes, verifier, push, router, seo-content, linter. **Sonnet** (reasoning) — everything else.

Agents are defined as markdown files in `~/.claude/agents/` with YAML frontmatter — dynamically loaded, not hardcoded. Add a new `.md` file and it appears in the dashboard immediately.

### Parallel Agent Groups

31 named compound workflows dispatch multiple agents in coordinated waves via `[CAST-DISPATCH-GROUP]`. Agents within a wave run in parallel; waves run sequentially.

```
morning-start  →  briefing + daily report             (2 waves)
feature-build  →  plan + implement + docs + security  (2 waves)
quality-sweep  →  security + review + QA + linting    (1 parallel wave)
ship-it        →  verify + test + devops              (1 wave → auto-stager, commit, push)
```

The full 31-group catalog lives in `~/.claude/config/agent-groups.json`.

---

## Local-First Architecture

Everything runs on your machine. No cloud, no telemetry, no external services.

- **File-system native** — reads `~/.claude/` directly; all agent definitions, memories, and configs are plain markdown and JSON files
- **SQLite-backed** — `cast.db` stores sessions, agent runs, task queue, memories, and routing events for structured queries
- **Human-editable** — every config file is readable and editable outside the dashboard; nothing is locked in a database
- **No telemetry** — no usage data sent anywhere; the dashboard never phones home
- **No account required** — no login, no API keys beyond what Claude Code already uses
- **Portable** — the `~/.claude/` directory is the source of truth; move it, back it up, version-control it

---

## Architecture

```
┌──────────────────┐     SSE (real-time)     ┌──────────────────┐
│                  │◀────────────────────────│                  │
│   React 19 SPA   │     REST (on demand)    │   Express 5 API  │
│   Vite 6 + HMR   │◀────────────────────────│   Port 3001      │
│   Port 5173      │     PUT/POST (editing)  │                  │
│                  │────────────────────────▶│   chokidar watch │
│   TanStack Query │                         │   JSONL parsing  │
│   React Router   │                         │   gray-matter    │
│   Tailwind v4    │                         │   better-sqlite3 │
└──────────────────┘                         └────────┬─────────┘
                                                      │ reads/writes
                                                      ▼
                                             ┌──────────────────┐
                                             │   ~/.claude/     │
                                             │                  │
                                             │   projects/      │ ← session JSONL logs
                                             │   agents/        │ ← agent definitions (r/w)
                                             │   agent-memory-  │
                                             │     local/       │ ← agent memories (r/w)
                                             │   commands/      │ ← slash commands
                                             │   skills/        │ ← skill definitions
                                             │   rules/         │ ← rule files
                                             │   plans/         │ ← implementation plans
                                             │   settings.json  │ ← configuration + hooks
                                             │   settings.local │
                                             │     .json        │ ← local overrides + hooks
                                             │   routing-log    │ ← dispatch decisions
                                             │   cast.db        │ ← structured run history
                                             │   cast/events/   │ ← immutable event log
                                             └──────────────────┘
```

### Coverage at a Glance

```
28 pattern routes  ·  42 agents  ·  6 tiers  ·  4 hooks  ·  31 agent groups  ·  11 directives
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/agents/:name` | PUT | Update agent frontmatter fields |
| `/api/agents` | POST | Create a new agent definition |
| `/api/agents/live` | GET | Currently running subagents |
| `/api/sessions` | GET | All sessions with summary stats |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/sessions/:project/:id` | DELETE | Delete a session |
| `/api/active` | GET | Sessions modified in the last 5 minutes |
| `/api/memory` | GET | Project and agent memory files |
| `/api/plans` | GET | Implementation plan files |
| `/api/rules` | GET | Rule files with previews |
| `/api/skills` | GET | Skill definitions with metadata |
| `/api/commands` | GET | Slash commands with agent routing |
| `/api/hooks` | GET | Hook definitions from hookify files |
| `/api/scripts` | GET | Shell scripts in `~/.claude/` |
| `/api/plugins` | GET | Plugin definitions |
| `/api/keybindings` | GET | Custom keybinding contexts |
| `/api/tasks` | GET | Active task directories with lock status |
| `/api/debug` | GET | Debug log entries |
| `/api/permissions` | GET | Permission settings |
| `/api/launch` | GET | Launch configuration |
| `/api/outputs/:category` | GET | Briefings, meetings, reports, or email-summaries |
| `/api/config/health` | GET | System health overview |
| `/api/analytics` | GET | Cross-session token/cost aggregates |
| `/api/search?q=` | GET | Global search across sessions, agents, plans, memories |
| `/api/routing/stats` | GET | Routing stats with hook/auto/senior-dev badges |
| `/api/routing/events` | GET | Raw routing event log |
| `/api/routing/table` | GET | Active routing patterns |
| `/api/cast/token-spend` | GET | 30-day token/cost data from `cast.db` |
| `/api/cast/agent-runs` | GET | Agent run history from `cast.db` |
| `/api/cast/task-queue` | GET | Current task queue from `cast.db` |
| `/api/cast/memories` | GET | Agent memories from `cast.db` |
| `/api/cast/explore/tables` | GET | List allowed tables in `cast.db` |
| `/api/cast/explore/:table` | GET | Paginated read of a `cast.db` table |
| `/api/castd/status` | GET | Daemon running status and queue depth |
| `/api/castd/logs` | GET | Last 100 lines of castd log |
| `/api/castd/start` | POST | Start castd via launchctl (rate-limited) |
| `/api/castd/stop` | POST | Stop castd via launchctl (rate-limited) |
| `/api/health/ollama` | GET | Ollama local model health check |
| `/api/events` | SSE | Real-time session and agent activity stream |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| UI Components | shadcn/ui, Lucide React, cmdk (Cmd+K palette), sonner (toasts) |
| Charts | Recharts, @nivo/network |
| Routing | React Router v6, React.lazy code splitting |
| State | TanStack Query v5, TanStack Virtual (virtualized lists) |
| Backend | Express 5, chokidar (file watching), tsx |
| Database | better-sqlite3 (`cast.db` — sessions, agent runs, task queue) |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Testing | Vitest, React Testing Library, Supertest |

---

## Development

```bash
npm run dev      # Start Express + Vite concurrently
npm run build    # Production build (tsc + vite)
npm test         # Run Vitest suite
npm run seed     # Seed cast.db with sample data
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
