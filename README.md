# Claude Code Dashboard

**The observability layer for CAST — a self-managing AI development team.**

Every AI coding tool today runs as a single generalist. CAST is different: the AI acts as a **Senior Dev** who interprets user intent, delegates to 28 specialized agents across model tiers (haiku/sonnet/opus), and tracks every delegation decision with full visibility.

```
Senior Dev Orchestration  |  28 Specialized Agents  |  Haiku-First Delegation
Live Activity Feed  |  Token Analytics  |  Cost Tracking  |  Agent Routing Stats
Session Replay  |  Agent Management  |  Knowledge Base  |  Global Search (Cmd+K)
```

---

## The CAST System

**CAST** (Claude Agent System & Team) is a three-layer architecture where the AI manages a team instead of doing everything itself.

### The Senior Dev (CLAUDE.md)

The main Claude session acts as a delegating manager — not a generalist coder. For every substantive prompt, it runs a **Triage Protocol**:

1. **Interpret** — What does the user actually need? (even from poor prompts)
2. **Decompose** — Multiple steps? → dispatch `planner` first
3. **Match** — Check the Agent Capability Registry → dispatch the right specialist
4. **Model Selection** — Prefer haiku agents for routine work (saves tokens)
5. **Dispatch** — Invoke the agent immediately

The Senior Dev **never** commits, reviews code, debugs errors, or plans multi-step work inline. Managers delegate — they don't do the work.

### The Agents (29 Specialists)

| Tier | Agents | Use for |
|------|--------|---------|
| **Haiku** (cheap, fast) | commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader, report-writer, meeting-notes | Routine work — commits, reviews, staging, cleanup, docs |
| **Sonnet** (reasoning) | planner, debugger, test-writer, security, researcher, architect, e2e-runner, qa-reviewer, readme-writer, data-scientist, email-manager, morning-briefing, browser, presenter | Complex tasks — planning, debugging, testing, security, research |
| **Opus** (architecture) | Via `opus:` prefix | System design, full codebase analysis |

### The Dashboard (This Repo)

Real-time observability — see which agents are running, what the Senior Dev dispatched, and how much it costs. Routing stats show three badge types: **hook** (regex match), **auto** (Agent tool), and **senior dev** (triage protocol).

---

## Features

### Live Activity
Real-time SSE feed of agent events. Watch tool calls, agent spawns, and routing decisions as they happen. Running agents panel shows active subagents with type, model, duration, and status.

### Agent Management
Browse all 29 agents with model badges, tool counts, and descriptions. Edit frontmatter fields directly in the UI. Create new agent definitions from a form. CAST Architecture diagram shows the delegation hierarchy with animated SVG connectors.

### Session Replay
Full session history with token usage, cost tracking per model, tool call breakdowns, and one-click markdown export. Resizable split panels for timeline and analytics.

### Agent Routing Stats
Coverage rate, miss rate (with trivial prompt filtering), top dispatched agents table with hook/auto/senior dev badges, and recent routing events feed with reasoning display.

### Knowledge Base
Seven-category explorer: memory files, rules, plans, skills, commands, settings, and outputs (briefings, meetings, reports). Copy-to-clipboard on everything.

### Analytics
Daily token burn trends (90 days), cost by project, model breakdown donut chart, tool usage heatmap, per-session cost tracking. Nivo heatmap for activity patterns.

### Global Search
Cmd+K command palette searching across sessions, agents, plans, and memories with categorized results and keyboard navigation.

---

## Quick Start

### 1. Install the Agent Team

```bash
git clone https://github.com/ek33450505/claude-agent-team.git
cd claude-agent-team && ./install.sh
```

Installs 29 agents, 31 commands, 10 skills, hooks, routing system, and rules into `~/.claude/`.

### 2. Start the Dashboard

```bash
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard && npm install && npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). Express API on port 3001.

### 3. Use Claude Code

The Senior Dev triage protocol is active immediately. Open any Claude Code session — the dashboard streams activity in real time.

### Requirements

- Node.js 18+
- `~/.claude/` directory (any Claude Code installation)
- macOS or Linux

> The dashboard works standalone with any `~/.claude/` directory. The Agent Team adds the full CAST orchestration layer.

---

## Architecture

```
┌──────────────────┐     SSE (real-time)     ┌──────────────────┐
│                  │◀────────────────────────│                  │
│   React 19 SPA   │     REST (on demand)    │   Express 5 API  │
│   Vite 6 + HMR   │◀────────────────────────│   Port 3001      │
│   Port 5173      │     PUT/POST (editing)  │                  │
│                  │────────────────────────▶│   chokidar watch  │
│   TanStack Query │                         │   JSONL parsing   │
│   React Router   │                         │   gray-matter     │
│   Tailwind v4    │                         │                  │
└──────────────────┘                         └────────┬─────────┘
                                                      │ reads/writes
                                                      ▼
                                             ┌──────────────────┐
                                             │   ~/.claude/      │
                                             │                  │
                                             │   projects/      │ ← session JSONL logs
                                             │   agents/        │ ← agent definitions (r/w)
                                             │   commands/      │ ← slash commands
                                             │   skills/        │ ← skill definitions
                                             │   rules/         │ ← rule files
                                             │   plans/         │ ← implementation plans
                                             │   agent-memory/  │ ← agent memories
                                             │   settings.json  │ ← configuration
                                             │   routing-log    │ ← dispatch decisions
                                             └──────────────────┘
```

### Enforcement Stack

```
Soft:   CLAUDE.md triage protocol + capability registry
Medium: route.sh context injection + PostToolUse code-review reminders
Hard:   git-commit-intercept.sh blocks raw git commit (exit code 2)
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/agents/:name` | PUT | Update agent frontmatter fields |
| `/api/agents` | POST | Create a new agent definition |
| `/api/agents/live` | GET | Currently running subagents with meta.json identity |
| `/api/sessions` | GET | All sessions with summary stats |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/active` | GET | Sessions modified in last 5 minutes |
| `/api/memory` | GET | Project and agent memory files |
| `/api/plans` | GET | Implementation plan files |
| `/api/plans/:name` | GET | Single plan with rendered body |
| `/api/rules` | GET | Rule files with previews |
| `/api/skills` | GET | Skill definitions with metadata |
| `/api/commands` | GET | Slash commands with agent routing |
| `/api/outputs/:category` | GET | Briefings, meetings, or reports |
| `/api/config/health` | GET | System health overview |
| `/api/analytics` | GET | Cross-session token/cost aggregates |
| `/api/search?q=` | GET | Global search across sessions, agents, plans, memories |
| `/api/routing/stats` | GET | Routing stats with senior dev / hook / auto badges |
| `/api/routing/events` | GET | Raw routing event log |
| `/api/routing/table` | GET | Active routing patterns |
| `/api/events` | SSE | Real-time session + agent activity stream |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion, Nivo, shadcn/ui |
| Design | Carbon Mint palette, Geist Sans/Mono, glassmorphism |
| Routing | React Router v6, React.lazy code splitting, View Transitions API |
| State | TanStack Query v5, TanStack Virtual |
| Backend | Express 5, chokidar, tsx |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Charts | Recharts, @nivo/heatmap, @nivo/network |

---

## Development

```bash
npm run dev          # Start both Express + Vite (concurrently)
npm run build        # Production build
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
