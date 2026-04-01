## v1.1.0 — 2026-03-31

### Added

- Routing events API: filter by event_type (`GET /api/routing/events?event_type=<type>`), list distinct event types (`GET /api/routing/event-types`)
- Memory API: `lastModified` timestamps on all memory files
- Memory backup status endpoint (`GET /api/memory/backup-status`) + manual trigger (`POST /api/memory/backup-trigger`)
- Activity page: agent spawn timeline (`task_claimed` events)
- Analytics page: prompt volume bar chart (`user_prompt_submit` events)
- Sessions page: "Compacted" badge on sessions with `context_compacted` events
- Memory page: last-modified display on cards + backup status widget with manual trigger
