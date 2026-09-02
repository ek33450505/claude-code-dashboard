import Database from 'better-sqlite3'
import { CAST_SCHEMA } from '../../shared/castSchema.js'

/**
 * Schema drift guard.
 *
 * The dashboard read-visualizes `cast.db`, whose schema is owned by CAST
 * (claude-agent-team `scripts/cast-db-init.sh`). When CAST renames/drops a
 * column or table, the dashboard's hand-written SQL silently returns empty or
 * wrong data — every route wraps its query in try/catch, so drift never
 * surfaces as an error. `verifySchema` compares the live DB against the
 * canonical contract so drift is caught loudly (a startup warning + a gating
 * test) instead of as a confidently-wrong number on a card.
 *
 * `EXPECTED_SCHEMA` used to be a hand-maintained duplicate of
 * `shared/castSchema.ts`'s column lists (D13: the two drifted independently,
 * which is exactly the failure mode this guard exists to prevent — a schema
 * contract that is itself out of sync). It is now DERIVED from `CAST_SCHEMA`,
 * which is the single source of truth for every (table, column) the dashboard
 * reads; edit `shared/castSchema.ts` to add a table/column, never here.
 *
 * Table set: every table in `CAST_SCHEMA` is checked, regardless of
 * `status`. `verifySchema` only asserts structural presence (the table and
 * its columns exist) — it never inspects row counts — so producer status is
 * orthogonal to what it checks:
 *   - `dormant` tables (e.g. `rate_limit_snapshots`) legitimately have zero
 *     rows because their writer is gated off, but the table itself still
 *     exists and its shape is exactly as fixed as a `live` table's. Zero
 *     rows is correct and this guard never flags it — but a genuinely
 *     missing table or a renamed column is still real drift and still
 *     worth a loud warning.
 *   - `dead_writer_retired` tables (e.g. `compaction_events`) keep valid
 *     historical rows and dependent routes still query them.
 *   - `RETIRED_TABLES` (fully gone, e.g. `stream_events`) are excluded
 *     automatically — they were never added to `CAST_SCHEMA` in the first
 *     place, so there is nothing to derive or check.
 * Checking the full set over the ~15 tables the old hand-written map covered
 * closes a real gap: tables like `task_queue`, `incidents`, `injection_log`,
 * `plan_sessions`, and `budgets` are dashboard dependencies per
 * `shared/castSchema.ts`'s own docstring but previously had zero drift
 * protection here.
 */
export const EXPECTED_SCHEMA: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(CAST_SCHEMA).map(([table, contract]) => [table, contract.columns]),
)

export interface SchemaDrift {
  table: string
  status: 'missing-table' | 'missing-columns'
  missing: string[]
}

/**
 * Compare the live DB against {@link EXPECTED_SCHEMA}. Read-only; never throws
 * for a missing table/column — only for a broken DB handle (caller guards).
 */
export function verifySchema(db: ReturnType<typeof Database>): SchemaDrift[] {
  const drift: SchemaDrift[] = []
  for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
    const exists = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(table)
    if (!exists) {
      drift.push({ table, status: 'missing-table', missing: [...cols] })
      continue
    }
    const actual = new Set(
      (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(r => r.name),
    )
    const missing = cols.filter(c => !actual.has(c))
    if (missing.length > 0) {
      drift.push({ table, status: 'missing-columns', missing })
    }
  }
  return drift
}

/**
 * Fail-soft startup check: log any schema drift as a warning and return it.
 * Never throws — a drift warning must not block the server from booting.
 */
export function logSchemaDrift(db: ReturnType<typeof Database> | null): SchemaDrift[] {
  if (!db) return []
  let drift: SchemaDrift[]
  try {
    drift = verifySchema(db)
  } catch (err) {
    console.warn('[schema-guard] verification failed (non-fatal):', err)
    return []
  }
  for (const d of drift) {
    if (d.status === 'missing-table') {
      console.warn(
        `[schema-guard] cast.db is missing table "${d.table}" — routes reading it will return empty. (CAST schema drift?)`,
      )
    } else {
      console.warn(
        `[schema-guard] cast.db table "${d.table}" is missing column(s): ${d.missing.join(', ')} — dependent routes may return wrong data.`,
      )
    }
  }
  if (drift.length === 0) {
    console.log('[schema-guard] cast.db schema matches dashboard expectations.')
  }
  return drift
}
