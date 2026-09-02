import type Database from 'better-sqlite3'

const dispatchNameSupport = new WeakMap<object, boolean>()

/**
 * True if dispatch_decisions has the dispatch_name column (flagship migration 033).
 * Cached per handle; a re-opened DB yields a new handle and is therefore re-probed.
 * Older cast.db installs — and the existing test fixtures — lack the column, so every
 * caller must tolerate its absence.
 */
function hasDispatchName(db: ReturnType<typeof Database>): boolean {
  const cached = dispatchNameSupport.get(db)
  if (cached !== undefined) return cached
  let has = false
  try {
    const cols = db.prepare('PRAGMA table_info(dispatch_decisions)').all() as Array<{ name: string }>
    has = cols.some(c => c.name === 'dispatch_name')
  } catch {
    has = false
  }
  dispatchNameSupport.set(db, has)
  return has
}

/**
 * Builds the correlated subquery resolving a dispatch prompt snippet for an `agent_runs`
 * row aliased `ar` (the caller's query MUST alias agent_runs as `ar`).
 *
 * Identity matching is two-tier because `agent_runs.agent` has two recording eras:
 *   - Newer rows store the full dispatch name (`backend-writer__u5-c1`), which matches
 *     `dispatch_decisions.dispatch_name` exactly.
 *   - Older rows store the bare roster type (`backend-writer`) even for named dispatches,
 *     and only match `dispatch_decisions.chosen_agent`.
 * `dispatch_name` is populated ONLY for named dispatches (still NULL for unnamed ones today),
 * so the chosen_agent branch is the ongoing majority path, not a legacy fallback. COALESCE
 * prefers the exact dispatch_name match and falls back to the roster type.
 *
 * Before this helper every call site used the chosen_agent branch alone, which silently
 * resolved NULL for every named dispatch: measured on the live DB, 0 of 959 named-dispatch
 * runs could ever match. Adding the dispatch_name branch took runs with a resolved summary
 * from 1545 to 2067 (+522) with 0 rows losing or changing a previously-resolved value.
 *
 * The ±60s window stays: a dispatch name recurs many times within one session, so the
 * temporal bound is what selects WHICH decision belongs to this run.
 *
 * `unixepoch()` is retained deliberately. Rewriting it to a sargable bare-column comparison
 * was measured and rejected: EXPLAIN QUERY PLAN shows SQLite picks the equality index and
 * keeps a temp B-tree either way (6.5ms vs 6.4ms over 10 runs), while unixepoch() normalizes
 * both stored timestamp formats (dispatch_decisions.created_at is `YYYY-MM-DD HH:MM:SS`,
 * agent_runs.started_at is `YYYY-MM-DDTHH:MM:SSZ`) and a string comparison would not.
 *
 * @param alias Column alias for the result. Must be a bare SQL identifier; callers pass a
 *              compile-time literal, never user input.
 */
export function taskSummarySubquery(
  db: ReturnType<typeof Database>,
  alias = 'task_summary',
): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error(`taskSummarySubquery: unsafe alias ${JSON.stringify(alias)}`)
  }
  const byChosenAgent = `(SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.chosen_agent = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1)`
  if (!hasDispatchName(db)) return `${byChosenAgent} AS ${alias}`
  const byDispatchName = `(SELECT dd.prompt_snippet FROM dispatch_decisions dd
            WHERE dd.session_id = ar.session_id AND dd.dispatch_name = ar.agent
              AND unixepoch(dd.created_at) <= unixepoch(ar.started_at) + 60
            ORDER BY unixepoch(dd.created_at) DESC LIMIT 1)`
  return `COALESCE(
          ${byDispatchName},
          ${byChosenAgent}
        ) AS ${alias}`
}
