import { makeTableRouter } from '../utils/makeTableRouter.js'
import { redactPath } from '../utils/projectKey.js'

interface CompactionEventRow {
  id: string; session_id: string; timestamp: string;
  trigger: string; compaction_tier: string | null; transcript_path: string | null
}

// GET /api/cast/compaction-events
export const compactionEventsRouter = makeTableRouter({
  table: 'compaction_events',
  columns: 'id, session_id, timestamp, trigger, compaction_tier, transcript_path',
  orderBy: 'timestamp DESC',
  key: 'events',
  tag: 'compaction-events',
  limit: { default: 100, max: 500 },
  // transcript_path is a DB column populated verbatim from Claude Code's own
  // PreCompact hook payload — an absolute path under ~/.claude/projects/<encoded>/,
  // so it leaks the username BOTH as a leading real-home prefix AND inside the
  // encoded project-directory segment mid-string. redactPath() (relativizeHome +
  // maskProjectKey) closes both; a bare relativizeHome() left the encoded segment
  // exposed (~93/93 rows leaked in a live-server check). Nothing downstream
  // reuses this field for I/O.
  mapRow: (r: CompactionEventRow) => ({
    ...r,
    transcript_path: redactPath(r.transcript_path) ?? null,
  }),
})
