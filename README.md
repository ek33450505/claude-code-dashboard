# Claude Code Dashboard

**Automatic agent routing, real-time observability, and token cost control for Claude Code — powered by CAST v2.**

Most Claude Code setups are a single generalist doing everything inline. Every commit, every review, every debug session at the same model tier. The cost adds up. The quality is inconsistent. And you're manually deciding which agent to use for every task.

CAST v2 fixes that. Hook-enforced routing dispatches the right specialist agent automatically — before Claude even starts responding. Haiku for commits, reviews, and cleanup. Sonnet for debugging, planning, and architecture. You stop thinking about tooling and start shipping.

The dashboard makes the whole system observable: which agents are running, what got dispatched and why, what it's costing you by model tier, and how your routing coverage is trending over time.

---

## How CAST v2 Works

Three enforcement layers fire before and after every Claude Code interaction:

```
UserPromptSubmit  →  route.sh           →  [CAST-DISPATCH]  →  specialist agent dispatched
PostToolUse       →  post-tool-hook.sh  →  [CAST-REVIEW]    →  code-reviewer auto-dispatched
PreToolUse        →  pre-tool-guard.sh  →  exit 2           →  raw git commit blocked
Stop              →  prompt hook        →  safety net       →  catches missed reviews/commits
```

**`[CAST-DISPATCH]` (UserPromptSubmit → route.sh)**
Every prompt hits `route.sh` before Claude responds. The script matches against 21 routing patterns and injects a `[CAST-DISPATCH]` directive that forces Claude to dispatch the matched agent immediately. No inline work, no model-tier guessing.

**`[CAST-REVIEW]` (PostToolUse → post-tool-hook.sh)**
Every `Write` or `Edit` tool call triggers `post-tool-hook.sh`, which injects a `[CAST-REVIEW]` directive. Code review happens automatically, every time — using `code-reviewer` on haiku.

**exit 2 block (PreToolUse → pre-tool-guard.sh)**
`git commit` issued directly in Bash returns exit code 2 — a hard block Claude cannot bypass. The only escape hatch is `CAST_COMMIT_AGENT=1 git commit`, which the `commit` agent uses internally. Message-injection and chained echo attacks are blocked.

### The 29 Agents

| Tier | Agents |
|------|--------|
| **Haiku** (fast, cheap) | commit, code-reviewer, build-error-resolver, auto-stager, refactor-cleaner, doc-updater, chain-reporter, db-reader, report-writer, meeting-notes |
| **Sonnet** (reasoning) | planner, debugger, test-writer, security, researcher, architect, e2e-runner, qa-reviewer, readme-writer, data-scientist, email-manager, morning-briefing, browser, presenter, orchestrator, router, bash-specialist, tdd-guide, verifier |

Agents are defined as markdown files in `~/.claude/agents/` with YAML frontmatter — dynamically loaded, not hardcoded. Add a new `.md` file and it appears in the dashboard immediately.

### Cross-Project Memory

Each agent that supports memory reads and writes to `~/.claude/agent-memory-local/<agent>/`. A `code-reviewer` that reviewed your auth middleware last week carries that context into a different project today. The Agents page shows a memory indicator with file count per agent.

---

## The Dashboard

### Activity (Live)

Real-time SSE stream of agent events. An agent grid shows all 29 agents with a pulse animation when one activates. The routing events feed shows each dispatch with action badge (`DISPATCHED`, `SUGGESTED`, `NO MATCH`), matched agent, and prompt preview.

### Analytics

- 30-day daily token burn area chart
- Model tier breakdown: haiku vs. sonnet vs. opus token share
- Delegation savings panel — actual token cost delta from tier routing
- Per-session cost tracking, current-month totals

### Sessions

Full session history with token counts, cost estimates, model used, and duration. Virtualized table handles large session counts without degrading. Delete sessions directly from the list.

### Agents

Categorized registry of all 29 agents. Each card shows: model tier badge, routing status (whether the agent has an active route), tool count, description, and memory file count. Inline frontmatter editing and new agent creation from a form.

The CAST v2 header at the top of the page displays the three enforcement directives and their scripts, live agent count, route count, and model tiers in use.

### System

Active hooks table (event, type, matcher, command) pulled from `~/.claude/settings.local.json`. Routing stats: coverage rate, miss rate, top dispatched agents with hook/auto/senior dev badges, and recent routing events with reasoning display. System health: agent count, command count, skill count, session count, plan count, rule count, project memories, agent memories.

### Knowledge Base

Seven-category explorer: memory files, rules, plans, skills, commands, settings, and outputs (briefings, meetings, reports). Copy to clipboard on all content. The `plans/` and `agent-memory-local/` directories are readable and browsable.

### Global Search (Cmd+K)

Command palette searching across sessions, agents, plans, and memories. Categorized results with keyboard navigation.

---

## Quick Start

### 1. Install the Agent Team

```bash
git clone https://github.com/ek33450505/claude-agent-team.git
cd claude-agent-team && ./install.sh
```

Installs 29 agents, slash commands, skills, hooks, and routing into `~/.claude/`.

### 2. Start the Dashboard

```bash
git clone https://github.com/ek33450505/claude-code-dashboard.git
cd claude-code-dashboard && npm install && npm run dev
```

React frontend at [http://localhost:5173](http://localhost:5173). Express API on port 3001.

### 3. Open Claude Code

Hooks are active immediately. Open any Claude Code session — routing fires on every prompt, the dashboard streams activity in real time.

### Requirements

- Node.js 18+
- `~/.claude/` directory (any Claude Code installation)
- macOS or Linux

The dashboard works standalone with any `~/.claude/` directory. The Agent Team adds the full CAST v2 enforcement layer.

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
                                             │   routing-log    │ ← dispatch decisions
                                             └──────────────────┘
```

### Routing Coverage at a Glance

```
21 pattern routes  ·  29 agents  ·  2 model tiers  ·  4 hooks
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
| `/api/outputs/:category` | GET | Briefings, meetings, or reports |
| `/api/config/health` | GET | System health overview |
| `/api/analytics` | GET | Cross-session token/cost aggregates |
| `/api/search?q=` | GET | Global search across sessions, agents, plans, memories |
| `/api/routing/stats` | GET | Routing stats with hook/auto/senior dev badges |
| `/api/routing/events` | GET | Raw routing event log |
| `/api/routing/table` | GET | Active routing patterns |
| `/api/events` | SSE | Real-time session and agent activity stream |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Framer Motion |
| UI Components | shadcn/ui, Lucide React, cmdk (Cmd+K palette) |
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

## License

MIT. See [LICENSE](LICENSE) for details.

---

Built by [Ed Kubiak](https://github.com/ek33450505). Part of the [CAST](https://github.com/ek33450505/claude-agent-team) system.
