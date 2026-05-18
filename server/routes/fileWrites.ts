import { Router } from 'express'
import { getCastDb } from './castDb.js'

export interface FileWriteRow {
  id: number
  session_id: string | null
  agent_name: string | null
  run_id: string | null
  file_path: string | null
  tool_name: string | null
  ts: string | null
  line_range: string | null
}

export const fileWritesRouter = Router()

const TABLE = 'file_writes'

function tableExists(): boolean {
  const db = getCastDb()
  if (!db) return false
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(TABLE)
  return !!row
}

// GET /api/file-writes — paginated list ordered by ts DESC
fileWritesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ entries: [], total: 0 })

    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 500)
    const offset = Math.min(Number(req.query.offset) || 0, 100_000)

    const entries = db.prepare(`
      SELECT id, session_id, agent_name, run_id, file_path, tool_name, ts, line_range
      FROM ${TABLE}
      ORDER BY ts DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as FileWriteRow[]

    const totalRow = db.prepare(`SELECT COUNT(*) AS cnt FROM ${TABLE}`).get() as { cnt: number }

    return res.json({ entries, total: totalRow.cnt })
  } catch (err) {
    console.error('[file-writes] error:', err)
    return res.json({ entries: [], total: 0 })
  }
})

// GET /api/file-writes/stats — group by agent_name
fileWritesRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db || !tableExists()) return res.json({ byAgent: {} })

    const rows = db.prepare(`
      SELECT agent_name, COUNT(*) AS cnt
      FROM ${TABLE}
      GROUP BY agent_name
      ORDER BY cnt DESC
    `).all() as Array<{ agent_name: string | null; cnt: number }>

    const byAgent: Record<string, number> = {}
    for (const row of rows) {
      byAgent[row.agent_name ?? 'unknown'] = row.cnt
    }

    return res.json({ byAgent })
  } catch (err) {
    console.error('[file-writes/stats] error:', err)
    return res.json({ byAgent: {} })
  }
})
