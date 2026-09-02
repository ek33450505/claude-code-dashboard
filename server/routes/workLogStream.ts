import { Router } from 'express'
import type Database from 'better-sqlite3'
import { getCastDb } from './castDb.js'
import { parseWorkLog, synthesizeWorkLog } from '../parsers/workLog.js'
import type { ParsedWorkLog } from '../parsers/workLog.js'
import { taskSummarySubquery } from '../utils/taskSummary.js'
import { clampLimit } from '../utils/clampLimit.js'

export const workLogStreamRouter = Router()

// ── Schema capability cache ──────────────────────────────────────────────────
//
// D13: these used to run `PRAGMA table_info(...)` fresh on every request. That was
// wasteful but not wrong — the checks themselves are load-bearing, not dead defensive
// code. `agent_runs.response` and `agent_truncations.agent_id` postdate older cast.db
// installs, and `workLogStream.test.ts` ("Schema resilience: ...") exercises both
// missing-column/missing-table branches directly. `shared/castSchema.ts` describes only
// the CURRENT canonical schema, so it can't stand in for this check — doing so would
// wrongly assume every live cast.db is already migrated.
//
// `getCastDb()` (server/routes/castDb.ts) caches a single long-lived handle for the
// process lifetime, so probing once per handle — cached here in a WeakMap keyed on the
// handle — is enough; this mirrors the existing pattern in `server/utils/taskSummary.ts`
// (`hasDispatchName`). A re-opened DB yields a new handle and is re-probed.
const responseColSupport = new WeakMap<object, boolean>()
const truncationSupport = new WeakMap<object, { tableExists: boolean; hasAgentIdCol: boolean }>()

function hasResponseColumn(db: ReturnType<typeof Database>): boolean {
  const cached = responseColSupport.get(db)
  if (cached !== undefined) return cached
  const cols = db.prepare('PRAGMA table_info(agent_runs)').all() as Array<{ name: string }>
  const has = cols.some(c => c.name === 'response')
  responseColSupport.set(db, has)
  return has
}

function getTruncationSupport(db: ReturnType<typeof Database>): { tableExists: boolean; hasAgentIdCol: boolean } {
  const cached = truncationSupport.get(db)
  if (cached) return cached
  const tableExists = !!db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
  ).get()
  const cols = tableExists
    ? (db.prepare('PRAGMA table_info(agent_truncations)').all() as Array<{ name: string }>)
    : []
  const result = { tableExists, hasAgentIdCol: cols.some(c => c.name === 'agent_id') }
  truncationSupport.set(db, result)
  return result
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkLogEntry {
  agentRunId: string
  agentName: string
  model: string | null
  sessionId: string | null
  startedAt: string
  status: string | null // DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT | null
  workLog: ParsedWorkLog | null
  partialWorkLog: string | null // from agent_truncations.partial_work_log
  isTruncated: boolean
  // Phase 3 annotation slots (null for now — populated in Phase 3 via LEFT JOINs)
  qualityGateVerdict: string | null
  dispatchedBy: string | null
  dispatchedTo: string[] | null
}

// ── DB row type ───────────────────────────────────────────────────────────────

interface AgentRunRow {
  id: number
  session_id: string | null
  agent: string
  model: string | null
  started_at: string | null
  status: string | null
  response: string | null      // agent's actual output (canonical)
  task_summary: string | null  // from dispatch_decisions.prompt_snippet (replaces dropped ar.prompt)
  // from correlated subquery against agent_truncations
  partial_work_log: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToEntry(row: AgentRunRow): WorkLogEntry {
  // response is the agent's output (Status block + Work Log) — preferred source.
  // task_summary (from dispatch_decisions.prompt_snippet) is a fallback when response is absent.
  const content = row.response ?? row.task_summary ?? ''
  // Try parsing a ## Work Log section from the content
  const workLog = parseWorkLog(content) ?? synthesizeWorkLog(content) ?? null

  // has_status was dropped by migration 028; partial_work_log is the sole truncation signal.
  const isTruncated = row.partial_work_log !== null

  return {
    agentRunId: String(row.id),
    agentName: row.agent,
    model: row.model,
    sessionId: row.session_id,
    startedAt: row.started_at ?? '',
    status: row.status,
    workLog,
    partialWorkLog: row.partial_work_log ?? null,
    isTruncated,
    // Phase 3 annotation slots — always null until Phase 3 implementation
    qualityGateVerdict: null,
    dispatchedBy: null,
    dispatchedTo: null,
  }
}

// ── GET /api/work-log-stream?limit=50&since=<iso> ─────────────────────────────

workLogStreamRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ entries: [] })

    const limit = clampLimit(req.query.limit, 50, 200)
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (since) {
      conditions.push('ar.started_at >= ?')
      params.push(since)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // agent_runs.response was added in agent-team d8612c0; older cast.db installs won't
    // have it — fall back to NULL so the row type stays consistent. Cached per db handle;
    // see the "Schema capability cache" block above.
    const responseSelect = hasResponseColumn(db) ? 'ar.response' : 'NULL AS response'

    // agent_id is required to avoid fan-out: (session_id, agent_type) is non-unique
    // (multiple truncation rows per agent type expand row count by ~1.65×).
    // Correlated subquery on agent_id guarantees at most ONE truncation row per run.
    const { tableExists: truncTableExists, hasAgentIdCol } = getTruncationSupport(db)

    let rows: AgentRunRow[]

    if (truncTableExists && hasAgentIdCol) {
      rows = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          ${taskSummarySubquery(db)},
          (SELECT t.partial_work_log FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS partial_work_log
        FROM agent_runs ar
        ${where}
        ORDER BY ar.started_at DESC
        LIMIT ?
      `).all([...params, limit]) as AgentRunRow[]
    } else {
      rows = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          ${taskSummarySubquery(db)},
          NULL AS partial_work_log
        FROM agent_runs ar
        ${where}
        ORDER BY ar.started_at DESC
        LIMIT ?
      `).all([...params, limit]) as AgentRunRow[]
    }

    const entries = rows.map(rowToEntry)
    return res.json({ entries })
  } catch (err) {
    console.error('[work-log-stream] GET / error:', err)
    return res.json({ entries: [] })
  }
})

// ── GET /api/work-log-stream/:agentRunId ──────────────────────────────────────

workLogStreamRouter.get('/:agentRunId', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.status(404).json({ error: 'Not found' })

    const { agentRunId } = req.params
    const id = parseInt(agentRunId, 10)
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid agentRunId' })

    // agent_runs.response was added in agent-team d8612c0; older installs won't have it.
    // Cached per db handle; see the "Schema capability cache" block above.
    const responseSelect = hasResponseColumn(db) ? 'ar.response' : 'NULL AS response'

    const { tableExists: truncTableExists, hasAgentIdCol } = getTruncationSupport(db)

    let row: AgentRunRow | null

    if (truncTableExists && hasAgentIdCol) {
      row = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          ${taskSummarySubquery(db)},
          (SELECT t.partial_work_log FROM agent_truncations t
            WHERE t.agent_id = ar.agent_id AND ar.agent_id IS NOT NULL
            ORDER BY t.timestamp DESC LIMIT 1) AS partial_work_log
        FROM agent_runs ar
        WHERE ar.id = ?
        LIMIT 1
      `).get(id) as AgentRunRow | null
    } else {
      row = db.prepare(`
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.status,
          ${responseSelect},
          ${taskSummarySubquery(db)},
          NULL AS partial_work_log
        FROM agent_runs ar
        WHERE ar.id = ?
        LIMIT 1
      `).get(id) as AgentRunRow | null
    }

    if (!row) return res.status(404).json({ error: 'Agent run not found' })

    const entry = rowToEntry(row)
    return res.json({ entry })
  } catch (err) {
    console.error('[work-log-stream] GET /:agentRunId error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})
