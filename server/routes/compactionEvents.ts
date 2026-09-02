import { makeTableRouter } from '../utils/makeTableRouter.js'
import { relativizeHome } from '../utils/relativizeHome.js'

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
  // PreCompact hook payload (an absolute path under ~/.claude/projects/) —
  // relativize on the way out (public, unauthenticated GET). Nothing
  // downstream reuses this field for I/O.
  mapRow: (r: CompactionEventRow) => ({
    ...r,
    transcript_path: relativizeHome(r.transcript_path ?? undefined) ?? null,
  }),
})
