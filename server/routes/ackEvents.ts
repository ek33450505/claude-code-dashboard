import { makeTableRouter } from '../utils/makeTableRouter.js'

interface AckEventRow {
  id: string; variable: string; value: string | null; has_reason: number;
  script: string | null; git_sha: string | null; session_id: string | null;
  repo: string | null; created_at: string
}

// GET /api/cast/ack-events
export const ackEventsRouter = makeTableRouter({
  table: 'ack_events',
  columns: 'id, variable, value, has_reason, script, git_sha, session_id, repo, created_at',
  orderBy: 'created_at DESC',
  key: 'events',
  tag: 'ack-events',
  limit: { default: 100, max: 500 },
  // A row with variable='CAST_HATCH_RECORD_CAP' is a sentinel meaning "N more hatch
  // uses were suppressed by the 8-per-command cap" (flagship docs/escape-hatches.md
  // Safety Note 10) — not an 18th kind of hatch. Flag it so the frontend renders a
  // distinct "N suppressed" notice instead of charting it as a normal hatch row.
  mapRow: (r: AckEventRow) => ({
    ...r,
    is_cap_sentinel: r.variable === 'CAST_HATCH_RECORD_CAP',
  }),
})
