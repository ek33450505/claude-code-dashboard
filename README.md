# Claude Dashboard

**Real-time visual observability for Claude Code agent orchestration.**

The first web UI that lets you see what Claude Code is actually doing — live agent activity, session history, memory browsing, and system health, all in one place.

```
7 Views  |  SSE Streaming  |  React 19 + Vite 6  |  Express 5 API
```

---

## What This Is

Claude Code runs in the terminal. It's powerful, but invisible — you can't see which agents are active, what tools they're calling, or how sessions unfolded after the fact. IDE-integrated tools like Cursor are closed ecosystems with no observability layer.

Claude Dashboard bridges that gap. It reads from `~/.claude/` (the same directory every Claude Code user has) and presents a real-time visual layer on top of your existing workflow. No modifications to Claude Code, no plugins required — just a read-only window into what's happening.

---

## Quick Start

```bash
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). The Express API runs on port 3001.

### Requirements

- Node.js 18+
- A `~/.claude/` directory (created by any Claude Code installation)
- macOS or Linux

---

## Views

### 1. Live Activity
Real-time feed of agent events via Server-Sent Events. Shows what Claude Code is doing right now — user messages, assistant responses, tool calls, agent spawns — as they happen. Active sessions pulse with a green indicator.

### 2. Sessions
Browse all past sessions with project name, duration, message counts, tool usage, and git branch. Click any session to see the full timeline.

### 3. Session Detail
Full timeline replay of a session. Color-coded cards for user messages (blue), assistant responses (indigo), tool calls (amber), and tool results (emerald). Sidechain entries are indented and dimmed.

### 4. Agents
Grid of all installed agents with model badge, tool count, color indicator, and description. Click any agent to see full configuration, tools list, disallowed tools, and the complete agent definition.

### 5. Knowledge
Four-tab browser for your Claude Code knowledge base:
- **Plans** — implementation plans with expandable markdown bodies
- **Project Memory** — per-project memories grouped by project
- **Agent Memory** — agent-learned patterns grouped by agent
- **Outputs** — briefings, meeting notes, and reports

### 6. System
Overview of your Claude Code installation: file counts (agents, commands, skills, sessions), active hooks, and environment details.

---

## Architecture

```
┌──────────────────┐     SSE (real-time)     ┌──────────────────┐
│                  │◀────────────────────────│                  │
│   React 19 SPA   │     REST (on demand)    │   Express 5 API  │
│   Vite 6 + HMR   │◀────────────────────────│   Port 3001      │
│   Port 5173      │                         │                  │
│                  │                         │   chokidar watch  │
│   TanStack Query │                         │   JSONL parsing   │
│   React Router   │                         │   gray-matter     │
│   Tailwind v4    │                         │                  │
└──────────────────┘                         └────────┬─────────┘
                                                      │ reads
                                                      ▼
                                             ┌──────────────────┐
                                             │   ~/.claude/      │
                                             │                  │
                                             │   projects/      │ ← session JSONL logs
                                             │   agents/        │ ← agent definitions
                                             │   commands/      │ ← slash commands
                                             │   skills/        │ ← skill definitions
                                             │   rules/         │ ← rule files
                                             │   plans/         │ ← implementation plans
                                             │   agent-memory/  │ ← agent memories
                                             │   settings.json  │ ← configuration
                                             └──────────────────┘
```

### Key Technical Decisions

- **Express over Electron**: Lightweight, cross-platform, matches the Node.js ecosystem Claude Code users already have. No heavy desktop framework needed.
- **SSE over WebSockets**: One-way data flow (server → client) is all we need. SSE is simpler, auto-reconnects, and works through proxies.
- **chokidar for file watching**: Watches `~/.claude/projects/` for JSONL changes. When a session log updates, the last entry is parsed and broadcast.
- **TanStack Query**: Server state management with 30s staleTime. No manual cache invalidation — just declare what data you need.
- **Read-only access**: The dashboard never writes to `~/.claude/`. It's a pure observer.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/sessions` | GET | All sessions with summary stats |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/active` | GET | Sessions modified in last 5 minutes |
| `/api/memory` | GET | Project and agent memory files |
| `/api/plans` | GET | Implementation plan files |
| `/api/plans/:name` | GET | Single plan with full body |
| `/api/outputs/:category` | GET | Briefings, meetings, or reports |
| `/api/config` | GET | Settings, CLAUDE.md, rules, hooks |
| `/api/events` | SSE | Real-time session activity stream |

---

## Companion: Claude Agent Team

This dashboard pairs with **[Claude Agent Team](https://github.com/ek33450505/claude-agent-team)** — a framework of 22 specialized agents, 23 slash commands, and 9 skills that supercharge Claude Code.

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Claude Agent Team         │     │   Claude Dashboard          │
│                             │     │                             │
│   22 agents, 23 commands,   │────▶│   Real-time agent activity  │
│   9 skills, hooks, rules    │     │   Session history & replay  │
│                             │     │   Agent roster & stats      │
│   Config layer (no runtime) │     │   Memory & knowledge viewer │
└─────────────────────────────┘     │   System health overview    │
          ~/.claude/                │                             │
                                    │   React 19 + Vite + Express │
                                    └─────────────────────────────┘
```

**Agent Team** handles orchestration. **Dashboard** handles observability. Together they form a complete Claude Code power-user toolkit.

The dashboard works with **any** Claude Code installation — you don't need the Agent Team framework to use it. But they're better together.

---

## Development

```bash
npm run dev          # Start both Express + Vite (concurrently)
npm run build        # Production build
npm run test         # Run tests (Vitest)
npm run test:watch   # Watch mode
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Recharts |
| Routing | React Router v6, React.lazy code splitting |
| State | TanStack Query v5 |
| Backend | Express 5, tsx (dev), chokidar |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Testing | Vitest, React Testing Library, jsdom, Supertest |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with Claude Code. Designed to make Claude Code visible.
