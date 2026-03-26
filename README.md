![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)

# Claude Code Dashboard

**Real-time visual observability for Claude Code agent orchestration**

See every agent dispatch, tool call, and session in real time — from a live activity feed to a pixel-art office where your CAST agents work.

---

Most Claude Code setups run as a single generalist doing everything inline. Every commit, every review, every debug session at the same model tier. Cost adds up. Quality is inconsistent. And you are manually deciding which agent to use for every task.

CAST fixes that. Hook-enforced routing dispatches the right specialist automatically — before Claude even starts responding. Haiku for commits, reviews, and cleanup. Sonnet for debugging, planning, and architecture.

The dashboard makes the whole system observable: which agents are running right now, what got dispatched and why, what it is costing you by model tier, and how your routing coverage is trending over time — rendered in a pixel-art office where agents walk their desks when active.

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

### Live View — Pixel-Art Agent Office

The centerpiece of the dashboard is a pixel-art office rendered in real time. Each agent has a desk. When an agent activates, its sprite animates. Tool calls and dispatch chains appear as overlays in the feed alongside the canvas.

- **Agent office canvas** — pixel-art room with per-agent desks and walking sprites, live-wired to SSE events
- **Dispatch chain tree** — ordered steps for each active session, showing agent name, project badge, and status as it resolves
- **Activity feed** — SSE stream of every tool call, write, dispatch, and status transition
- **Work log section** — current activity per agent parsed from `TodoWrite` in-progress items and last tool use

### Home

Landing page with live system stats (agent count, session count, routing coverage), a recent activity ticker, current-month cost summary, and quick links to all views.

### Routing Log

Filterable table of every routing decision from `routing-log.jsonl`. Charts show dispatch frequency by agent and match type over time. Filter by action, agent, or date range.

### Analytics

- 30-day daily token burn area chart
- Model tier breakdown: haiku vs. sonnet token share (pie chart + bar chart)
- Delegation savings panel — actual token cost delta from tier routing
- Tool call frequency charts
- Per-session cost tracking and current-month totals

### Sessions

Full session history with token counts, cost estimates, model used, and duration. Virtualized table handles large session counts. Delete sessions directly from the list. Session detail view shows the full JSONL event stream with tool call expansion and markdown export.

### Agents

Categorized registry of all 42 agents across 6 tiers. Each card shows: model tier badge, routing status, tool count, description, and memory file count. Inline frontmatter editing and new agent creation from a form.

### System

Active hooks table pulled from `~/.claude/settings.local.json`. System health stats: agent count, command count, skill count, session count, plan count, rule count, and memory file counts. Routing stats: coverage rate, miss rate, and top dispatched agents with hook/auto/senior-dev badges.

### Knowledge Base (CLAW)

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

### Global Search (Cmd+K)

Command palette searching across sessions, agents, plans, and memories. Categorized results with keyboard navigation.

---

## Feature Summary

| Feature | Description |
|---|---|
| Pixel-Art Agent Office | Live canvas where CAST agents animate at their desks during active sessions |
| Live Activity (SSE) | Real-time event stream of agent dispatches, tool calls, and routing decisions |
| Dispatch Chain Tree | Ordered step-by-step view of each session's agent chain with status resolution |
| 3-Stage Routing | Pattern match → NLU router → inline fallback, enforced before every prompt |
| Routing Log View | Filterable event table and dispatch charts from `routing-log.jsonl` |
| Agent Groups | 31 named compound workflows dispatching parallel agent waves |
| 11 Hook Directives | `[CAST-DISPATCH]`, `[CAST-CHAIN]`, `[CAST-REVIEW]`, `[CAST-HALT]`, `[CAST-DEBUG]`, and 6 more |
| Event Sourcing | Append-only `~/.claude/cast/events/` log — immutable dispatch record |
| Pre-Tool Guards | `git commit` and `git push` hard-blocked at OS level via exit 2 |
| Agent Memory Viewer | Per-agent memory files with type badges across all projects |
| Analytics | 30-day token burn, model tier breakdown, delegation savings, per-session cost |
| Knowledge Base (CLAW) | 14-category explorer covering the full `~/.claude/` directory |
| Cost Tracking | Real-time haiku vs. sonnet spend with current-month totals |
| Mobile Responsive | Full UI adapts to mobile viewport |
| Global Search | Cmd+K command palette across sessions, agents, plans, and memories |

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
│   Tailwind v4    │                         │                  │
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
| `/api/events` | SSE | Real-time session and agent activity stream |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| UI Components | shadcn/ui, Lucide React, cmdk (Cmd+K palette), sonner (toasts) |
| Charts | Recharts, @nivo/heatmap, @nivo/network, @nivo/sankey |
| Routing | React Router v6, React.lazy code splitting |
| State | TanStack Query v5, TanStack Virtual (virtualized lists) |
| Backend | Express 5, chokidar (file watching), tsx |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Testing | Vitest, React Testing Library, Supertest |

---

## Development

```bash
npm run dev      # Start Express + Vite concurrently
npm run build    # Production build (tsc + vite)
npm test         # Run Vitest suite
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT. See [LICENSE](LICENSE) for details.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
