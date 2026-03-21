# Claude Code Dashboard

**Real-time visual observability and configuration for Claude Code agent orchestration.**

A branded web UI that lets you see what Claude Code is actually doing — live agent activity, session history, memory browsing, agent editing, and system health, all in one place. Built with the Carbon Mint design system.

```
7 Views  |  SSE Streaming  |  Agent Editing  |  Carbon Mint UI
React 19 + Vite 6  |  Express 5 API  |  Geist Typography
```

---

## What This Is

Claude Code runs in the terminal. It's powerful, but invisible — you can't see which agents are active, what tools they're calling, or how sessions unfolded after the fact. IDE-integrated tools like Cursor are closed ecosystems with no observability layer.

Claude Code Dashboard bridges that gap. It reads from `~/.claude/` (the same directory every Claude Code user has) and presents a real-time visual layer on top of your existing workflow. Edit agent configurations directly from the UI, browse your entire knowledge base, and monitor live activity — no terminal navigation required.

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

## Design System — Carbon Mint

A dark, modern design language built for developer tools:

| Element | Value |
|---|---|
| Background | `#070A0F` (primary), `#1A1D23` (cards) |
| Accent | `#00FFC2` (mint green) |
| Text | `#E6E8EE` (primary), `#88A3D6` (secondary) |
| Typography | Geist Sans (UI) + Geist Mono (code) |
| Cards | 16px radius squircles with glassmorphism borders |
| Layout | Bento grid with responsive columns |
| Sidebar | Collapsible icon rail with localStorage persistence |

---

## Views

### 1. Home
Branded landing page with live stats, feature overview, architecture diagram, and getting started guide. The entry point that explains the product and its capabilities.

### 2. Live Activity
Real-time feed of agent events via Server-Sent Events. Shows what Claude Code is doing right now — user messages, assistant responses, tool calls, agent spawns — as they happen.

### 3. Sessions
Browse all past sessions with project name, duration, message counts, tool usage, and git branch. Click any session to see the full timeline with color-coded message cards.

### 4. Agents
Grid of all installed agents with model badges (sonnet/haiku/opus), tool counts, color indicators, memory status, and descriptions. Click any agent to view full configuration and definition.

**Agent Editing:** Click "Edit" on any agent to modify frontmatter fields directly in the UI — model, color, description, tools, disallowed tools, max turns, and memory mode. Changes write back to the `.md` file on disk via atomic file operations.

**Create New Agents:** Click "+ New Agent" to create a new agent definition from scratch with a form modal. The agent `.md` file is created in `~/.claude/agents/`.

### 5. Knowledge
Seven category bento cards that expand to reveal your full Claude Code knowledge base:

- **Memory** — Project and agent memory files with type badges (user, feedback, project, reference), plus CLAUDE.md
- **Rules** — Global rule files with preview text
- **Plans** — Implementation plans sorted by recency, click through to a full-page rendered markdown detail view
- **Skills** — Skill definitions with descriptions
- **Commands** — Slash commands with agent routing info
- **Settings** — `settings.json` and `settings.local.json` rendered in a code viewer
- **Outputs** — Briefings, meeting notes, and reports

### 6. System
Overview of your Claude Code installation: file counts (agents, commands, skills, sessions), active hooks, and environment details.

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
                                             └──────────────────┘
```

### Key Technical Decisions

- **Express over Electron**: Lightweight, cross-platform, matches the Node.js ecosystem Claude Code users already have.
- **SSE over WebSockets**: One-way data flow (server → client) is all we need. SSE is simpler, auto-reconnects, and works through proxies.
- **chokidar for file watching**: Watches `~/.claude/projects/` for JSONL changes. When a session log updates, the last entry is parsed and broadcast.
- **TanStack Query**: Server state management with 30s staleTime and mutation-based cache invalidation for agent editing.
- **gray-matter.stringify()**: Agent edits update YAML frontmatter while preserving the markdown body, using atomic writes (temp file + rename).
- **Collapsible sidebar**: Icon rail (`w-16`) or expanded (`w-64`) with localStorage-persisted state and a floating edge toggle.

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/agents` | GET | All installed agents with parsed frontmatter |
| `/api/agents/:name` | GET | Single agent with full markdown body |
| `/api/agents/:name` | PUT | Update agent frontmatter fields |
| `/api/agents` | POST | Create a new agent definition |
| `/api/sessions` | GET | All sessions with summary stats |
| `/api/sessions/:project/:id` | GET | Full JSONL entries for a session |
| `/api/active` | GET | Sessions modified in last 5 minutes |
| `/api/memory` | GET | Project and agent memory files |
| `/api/plans` | GET | Implementation plan files |
| `/api/plans/:name` | GET | Single plan with rendered body |
| `/api/rules` | GET | Rule files with previews |
| `/api/rules/:filename` | GET | Single rule with full content |
| `/api/skills` | GET | Skill definitions with metadata |
| `/api/skills/:name` | GET | Single skill with full content |
| `/api/commands` | GET | Slash commands with agent routing |
| `/api/commands/:name` | GET | Single command with full content |
| `/api/outputs/:category` | GET | Briefings, meetings, or reports |
| `/api/config` | GET | Settings and CLAUDE.md |
| `/api/config/settings` | GET | Global settings.json content |
| `/api/config/settings-local` | GET | Local settings overrides |
| `/api/config/health` | GET | System health overview |
| `/api/events` | SSE | Real-time session activity stream |

---

## Companion: Claude Agent Team

This dashboard pairs with **[Claude Agent Team](https://github.com/ek33450505/claude-agent-team)** — a framework of 22 specialized agents, 23 slash commands, and 9 skills that supercharge Claude Code.

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Claude Agent Team         │     │   Claude Code Dashboard     │
│                             │     │                             │
│   22 agents, 23 commands,   │────▶│   Real-time agent activity  │
│   9 skills, hooks, rules    │     │   Session history & replay  │
│                             │     │   Agent editing & creation  │
│   Config layer (no runtime) │     │   Knowledge base browser    │
└─────────────────────────────┘     │   System health overview    │
          ~/.claude/                │                             │
                                    │   Carbon Mint design system │
                                    └─────────────────────────────┘
```

**Agent Team** handles orchestration. **Dashboard** handles observability and configuration. Together they form a complete Claude Code power-user toolkit.

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
| Design | Carbon Mint palette, Geist Sans/Mono, glassmorphism |
| Routing | React Router v6, React.lazy code splitting |
| State | TanStack Query v5 (queries + mutations) |
| Backend | Express 5, tsx (dev), chokidar |
| Parsing | gray-matter (YAML frontmatter), JSONL line reader |
| Testing | Vitest, React Testing Library, jsdom, Supertest |

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

Built with Claude Code. Designed to make Claude Code visible.
