/**
 * Timestamp handling for cast.db values — the single normalizer for server AND client.
 *
 * cast.db genuinely mixes FOUR encodings (verified against the live DB, 2026-09-01; the
 * flagship states it outright in `scripts/migrations/034_ack_events.sql`):
 *
 *   A  ISO-8601 UTC, second precision   `2026-09-01T23:42:23Z`
 *      sessions.*, agent_runs.started_at/ended_at/abandoned_at, routing_events.timestamp,
 *      incidents.occurred_at, quality_gates.timestamp, commit_provenance.recorded_at
 *   B  ISO-8601 with sub-second/offset  `2026-09-01T18:22:25.804740+00:00`
 *      hook_failures.timestamp, agent_hallucinations.timestamp, agent_memories.*, budgets.*
 *      (eval_runs.started_at/ended_at use `+00:00`, NOT `Z`)
 *   C  SQLite space format, implicitly UTC   `2026-09-01 23:45:30`
 *      dispatch_decisions.created_at, ack_events.created_at, quality_gates.created_at,
 *      task_queue.created_at, dispatch_events.triggered_at, file_writes.ts,
 *      provenance_chain.created_at, completeness_events.created_at
 *   D  Unix epoch SECONDS (integer)     `1783100402`
 *      pane_bindings.started_at/ended_at, rate_limit_snapshots.ts
 *      (otel_*.time_unix_nano is NANOseconds — not handled here; convert at the call site)
 *
 * Format C is the dangerous one: JS parses a space-separated datetime as LOCAL time, so an
 * un-normalized value renders as "in 4 hours" on a UTC-offset machine. Format A sorts AFTER
 * format C lexicographically ('T' 0x54 > ' ' 0x20), which is why SQL comparisons across the
 * two must go through `unixepoch()`/`datetime()` rather than raw `<`/`>`.
 */

/** Milliseconds bound below which a bare number is read as epoch seconds, not epoch ms. */
const EPOCH_SECONDS_CEILING = 1e11 // ~year 5138 in seconds; ~1973 in ms

/**
 * Normalize any cast.db timestamp to an ISO-8601 string JS parses as UTC.
 * Returns `null` for null/empty/unparseable input — callers decide how to render "unknown"
 * rather than silently receiving `Invalid Date` or the epoch.
 */
export function parseTimestamp(ts: string | number | null | undefined): string | null {
  if (ts === null || ts === undefined) return null

  // D — epoch, as a number or as an all-digit string
  if (typeof ts === 'number' || /^\d+$/.test(String(ts).trim())) {
    const n = Number(ts)
    if (!Number.isFinite(n) || n <= 0) return null
    const ms = n < EPOCH_SECONDS_CEILING ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const s = String(ts).trim()
  if (!s) return null

  // C — 'YYYY-MM-DD HH:MM:SS[.fff]' with no zone marker: SQLite writes these as UTC.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return s.replace(' ', 'T') + 'Z'
  }

  // A and B pass through — 'Z' and '+00:00' are both parsed as UTC by JS.
  // A bare 'YYYY-MM-DDTHH:MM:SS' with no zone is parsed as LOCAL by JS, so pin it to UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return s + 'Z'
  }

  return s
}

/** Epoch milliseconds for any cast.db timestamp, or `null` if unparseable. */
export function toEpochMs(ts: string | number | null | undefined): number | null {
  const iso = parseTimestamp(ts)
  if (iso === null) return null
  const ms = new Date(iso).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Relative time — "2h ago", "Yesterday", "just now". Returns '—' for unparseable input. */
export function timeAgo(ts: string | number | null | undefined): string {
  const then = toEpochMs(ts)
  if (then === null) return '—'

  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`

  return new Date(then).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Locale time of day (HH:MM:SS). Returns '' for unparseable input. */
export function formatTimeOfDay(ts: string | number | null | undefined): string {
  const ms = toEpochMs(ts)
  if (ms === null) return ''
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Absolute date + time, e.g. "Sep 1, 2026, 7:42 PM".
 * Replaces the six near-identical local `formatDate`/`fmtTime` helpers that each called
 * `new Date(ts)` directly and so skipped format-C normalization entirely.
 */
export function formatDateTime(ts: string | number | null | undefined): string {
  const ms = toEpochMs(ts)
  if (ms === null) return '—'
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** UTC calendar day (`YYYY-MM-DD`) — matches the `day` key in agent_runs_daily / mcp_calls_daily. */
export function utcDay(ts: string | number | null | undefined): string | null {
  const iso = parseTimestamp(ts)
  return iso === null ? null : iso.slice(0, 10)
}

/** Duration in ms as "Xh Ym" / "Xm Ys" / "Xs". Returns '--' for null. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '--'
  if (ms < 0) return '0s'
  if (ms < 1000) return '<1s'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/** Elapsed ms between two cast.db timestamps, or `null` if either is unparseable. */
export function durationMsBetween(
  start: string | number | null | undefined,
  end: string | number | null | undefined,
): number | null {
  const a = toEpochMs(start)
  const b = toEpochMs(end)
  return a === null || b === null ? null : b - a
}
