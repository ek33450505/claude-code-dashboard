import { Router } from 'express'
import { getCastDb } from '../routes/castDb.js'
import { clampLimit } from './clampLimit.js'
import { tableExists } from './tableExists.js'

/**
 * Config for a GET-only "list a cast.db table" route. `makeTableRouter` builds these
 * eight-line routes (25 lines pre-factoring) so the missing-DB / missing-table / catch
 * paths can never drift from the success shape or from each other — see `respond` below.
 */
export interface TableRouteConfig {
  /** cast.db table name. Developer-supplied, never user input — validated at construction. */
  table: string
  /** Raw SELECT column list (kept verbatim so per-route aliases survive).
   *  TRUST BOUNDARY: interpolated into SQL unvalidated. Callers MUST pass a literal defined
   *  in the route module -- never a request value. Only `table` is regex-checked; `columns`
   *  and `orderBy` are validated at code-review time, not at runtime. */
  columns: string
  /** ORDER BY clause without the keywords, e.g. 'timestamp DESC'.
   *  Same trust boundary as `columns` above: literal only, never request-derived. */
  orderBy: string
  /** Envelope key for the row array, e.g. 'runs'. */
  key: string
  /** console.error prefix, e.g. 'eval-runs'. */
  tag: string
  /** Query-param limit, a fixed literal, or omit for no LIMIT clause. */
  limit?: { default: number; max: number } | { fixed: number }
  /** Adds `total` (COUNT(*) over the whole table) to the envelope. */
  includeTotal?: boolean
  /** Per-row transform applied after the query (e.g. relativizeHome on path columns). */
  mapRow?: (row: any) => any
  /** Custom envelope. Defaults to { [key]: rows } (+ total when includeTotal). Used for BOTH
   *  the populated response and every empty/error response, so they cannot diverge. */
  respond?: (rows: any[], total: number) => Record<string, unknown>
}

const VALID_TABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Builds an Express router implementing `GET /` against a single cast.db table: open DB,
 * check the table exists, run a bounded SELECT, and return a JSON envelope. Every failure
 * path (DB unopened, table missing, query throws) returns HTTP 200 with the empty envelope
 * — these routes never 404 or 500, matching the eight hand-rolled routes this replaces.
 */
export function makeTableRouter(config: TableRouteConfig): Router {
  const { table, columns, orderBy, key, tag, limit, includeTotal, mapRow, respond } = config

  if (!VALID_TABLE_NAME.test(table)) {
    throw new Error(`makeTableRouter: invalid table name "${table}"`)
  }

  const buildResponse =
    respond ?? ((rows: any[], total: number) => (includeTotal ? { [key]: rows, total } : { [key]: rows }))

  const router = Router()

  router.get('/', (req, res) => {
    try {
      const db = getCastDb()
      if (!db) return res.json(buildResponse([], 0))
      if (!tableExists(db, table)) return res.json(buildResponse([], 0))

      let limitClause = ''
      const limitParams: number[] = []
      if (limit) {
        const n = 'fixed' in limit ? limit.fixed : clampLimit(req.query.limit, limit.default, limit.max)
        limitClause = ' LIMIT ?'
        limitParams.push(n)
      }

      let total = 0
      if (includeTotal) {
        total = (db.prepare(`SELECT COUNT(*) AS cnt FROM ${table}`).get() as { cnt: number }).cnt
      }

      const rows = db
        .prepare(`SELECT ${columns} FROM ${table} ORDER BY ${orderBy}${limitClause}`)
        .all(...limitParams) as any[]

      const mapped = mapRow ? rows.map(mapRow) : rows

      return res.json(buildResponse(mapped, total))
    } catch (err) {
      console.error(`[${tag}] error:`, err)
      return res.json(buildResponse([], 0))
    }
  })

  return router
}
