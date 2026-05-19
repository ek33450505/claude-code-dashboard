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
