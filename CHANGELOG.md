## [2.5.0] — 2026-06-22

### Added

- **New pages:** Outputs view (agent briefings, meetings, reports); Evals page (eval-harness pass@k); Executive summary page (`/executive`)
- **Agent Reliability tabs:** Worktree Anomalies, Protocol Violations, Truncations (surfacing v8 CAST tables)
- **System page:** Managed Agents section (Swarm page), Memory Consolidation section (Memory page), Integrity tab (Litestream health + rate-limit gauge)
- **Agent Reliability enhancements:** dispatch-events wiring, plan-sessions surface, health endpoint
- **Local agent roster:** Installed-count + live/built-in provenance pill on Agents page
- **Dark/light theme toggle:** Top bar, localStorage-persisted, defaults to `prefers-color-scheme`, AA contrast in both themes, no-FOUC (`src/state/themeState.tsx`, `.light` CSS tokens)
- **Design system foundation:** Glass cards, texture, kicker headers, status pill, motion library (`src/lib/motion.ts`)
- **Motion & animation:** Entrance animations on Sessions + Analytics views; equal-height stat cards
- **Brand consistency:** SectionHeader adoption across views
- **Schema integrity:** schemaGuard.ts + schema-contract test (prevents silent data-correctness bugs on route/field name mismatches)

### Fixed

- **Data-correctness bugs:** Executive summary queried wrong columns (plans, hook-failures, quality-gates); dispatch route repointed to `dispatch_events` table; tool-failures route now reads `tool_call_failures` table; SQLite explorer allow-list corrected (`server/routes/*.ts`)
- `PORT` env var now honored by Express server + Vite proxy (`server/index.ts`, `vite.config.ts`)
- Pricing tab field mapping corrected — reads `cost_per_million_input/output` (`src/views/SystemView.tsx`)
- Hook Failures infinite-refetch loop (memoized `since` dep in `useHookFailures`)

### Security

- **Opt-in control surface:** All command-executing endpoints (`/api/control/*`, `/api/castd/*`, `/api/cast/exec`) gated behind `CAST_DASHBOARD_CONTROL=1` env guard + `DASHBOARD_TOKEN` header (constant-time comparison); read-only by default (404 when disabled)
- helmet security headers added
- Rate limiters on `/api/cast/seed` + `/api/cast/exec` endpoints
- Argument validation on castd routes; raw error leakage removed
- Home path relativization in file operations

### Accessibility

- **WCAG 2.1 AA pass:** ARIA tablists with keyboard navigation; modal focus traps + Escape key; focus-visible rings on all interactive elements; `prefers-reduced-motion` support; screen-reader labels on icon buttons, charts, tables (`src/components/Tabs.tsx`, `src/lib/useModalA11y.ts`)
- Contrast ≥ 4.5:1 in light and dark themes

---

## [2.4.1] — 2026-06-05

### Fixed
- Agent roster corrected: 30-agent fallback (including 7 retired agents) replaced with the real 23 v7.4 agents; `eval-writer` and `pr-reviewer` added; `adr-writer`, `email-drafter`, `knowledge-curator`, `learning-scout`, `meeting-prep`, `portfolio-sync`, `pr-narrator`, `standup-writer`, `task-triage` removed (`server/routes/agents.ts`, `src/utils/localAgents.ts`)
- Test updated to assert 23 agents (`src/utils/localAgents.test.ts`)
- Removed dead `/file-writes` route from `server/routes/index.ts` and `src/App.tsx`; deleted orphaned `src/views/FileWritesView.tsx` (CHANGELOG v2.4.0 said page was removed but backend route was never cleaned up)
- Hardcoded absolute path in `server/routes/control.ts` replaced with `CAST_REPO_PATH` env var + `os.homedir()` fallback
- README: broken `/worklog` link → `/work-log`; broken `/sqlite-explorer` → `/system` (DB tab); removed "demo GIF coming soon" placeholder; "Constellation 3D graph" claim removed from cast-desktop description; "Cron-based" scheduling → "launchd (macOS) + RemoteTrigger"; `CAST v4.6 Architecture` heading made version-neutral; `v4.6+` version pins updated to `v7+`
- `src/views/SessionsView.tsx`: stale "CAST v6.0 HTTP hooks" string → "CAST hooks"
- `docs/LIVE_ACTIVITY_REDESIGN.md`: "36 specialized agents, pattern-based routing" → "23 specialist agents, model-driven dispatch"

---

## [2.4.0] — 2026-05-19

### Added
- HooksView: dedicated page for CAST hook definitions grouped by event type
- MemoryView: dedicated page for agent and project memory entries with type badges and detail modal
- PlansView: dedicated page for CAST plans with hover preview and detail modal
- AgentStatusBadge: shared component extracted from AgentsView inline logic
- Smoke tests for SessionsView, AgentsView, SystemView, SqliteExplorerView, HooksView, MemoryView, PlansView (474 tests total)

### Fixed
- Sessions soft-delete: server now filters deleted sessions from list; DELETE endpoint performs soft-delete (DB record) instead of hard file unlink
- Cost Summary: Input Tokens and Output Tokens now show actual values per model instead of "—"
- Pricing tab: model-pricing.json parsed correctly — metadata keys (_comment, _note) no longer appear as model rows
- SqliteExplorer: table descriptions expanded to 30+ tables; removed stale stream_hook_events entry

### Removed
- File Writes page removed from navigation (no backing data in cast.db)

---

## [2.2.0] — 2026-05-03

### Added

- **Telemetry surfaces:** Five new cast.db tables now exposed in the dashboard
  - Parry Guard events (`/api/parry-guard`)
  - Agent Truncations (`/api/agent-truncations`)
  - Injection Log (`/api/injection-log`)
  - Dispatch Decisions (`/api/dispatch-decisions`)
  - Unstaged File Warnings (`/api/unstaged-warnings`)
- **Dynamic agent roster:** `GET /api/agents/roster` reads `~/.claude/agents/*.md` at request time — future agent additions require no dashboard change
- **UI sections:** Health Signals (System page), Routing Intel (Agents page), Unstaged Warnings (Sessions page)
- **Test coverage:** 20 new unit and route tests (315/315 passing total)

### Changed

- `LOCAL_AGENTS` roster expanded from 16 (v3) to 30 (v6.0); demoted to fallback-only behind the new roster API
- Version string alignment: `CAST v4.6` → `CAST v6.0` in SessionsView (766a1ba, d1b0352)
- README hook-count claim corrected: "81 hooks" → "26 registered handlers across 13 events"
- 10 backend routers in `server/routes/index.ts` annotated with `// TODO(alignment)` or `// USED BY:` comments for future cleanup

### Removed

- `src/views/HookHealthView.tsx` and `server/routes/hookHealth.ts` (orphaned — backed a `hook_health` table that does not exist in the cast.db schema)
- Stale reference to deleted `hookHealth.ts` from `phase975c.test.ts` docstring

---

## v2.0.0 — 2026-04-03

### Changed

- Consolidated from 21 views and 7 nav groups down to 4 pages: Dashboard, Sessions, Analytics, System
- System page absorbs Agents, Rules, Skills, Hooks, Memory, Plans, DB Explorer, and Cron into a single tabbed interface
- Analytics page absorbs Token Spend and Quality Gates views
- Sessions page absorbs Dispatch Log, Routing, and Agent Runs views
- Removed standalone pages: Activity, Dispatch Log, Token Spend, Quality Gates, Hook Health, Knowledge, Rules, Memory, Privacy, Plans, DB Explorer, Castd
- All old URLs redirect to the appropriate new page via React Router `<Navigate>`
- Removed dead backend routes: privacyAudit, launch, permissions, plugins, privacy audit

### Removed

- 14 view files deleted (Activity, DispatchLog, TokenSpend, QualityGates, HookHealth, Knowledge, Rules, Memory, Privacy, Plans, DbExplorer, Castd, and others)
- Unused API hooks and utility files cleaned up

---

## v1.1.0 — 2026-03-31

### Added

- Routing events API: filter by event_type (`GET /api/routing/events?event_type=<type>`), list distinct event types (`GET /api/routing/event-types`)
- Memory API: `lastModified` timestamps on all memory files
- Memory backup status endpoint (`GET /api/memory/backup-status`) + manual trigger (`POST /api/memory/backup-trigger`)
- Activity page: agent spawn timeline (`task_claimed` events)
- Analytics page: prompt volume bar chart (`user_prompt_submit` events)
- Sessions page: "Compacted" badge on sessions with `context_compacted` events
- Memory page: last-modified display on cards + backup status widget with manual trigger
