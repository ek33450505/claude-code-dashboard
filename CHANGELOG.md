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
