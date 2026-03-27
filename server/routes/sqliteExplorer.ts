import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const sqliteExplorerRouter = Router()

const ALLOWED_TABLES = new Set([
  'sessions',
  'agent_runs',
  'task_queue',
  'agent_memories',
  'routing_events',
  'budgets',
])

sqliteExplorerRouter.get('/tables', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ tables: [] })
    }
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>
    const tables = rows.map(r => r.name).filter(n => ALLOWED_TABLES.has(n))
    res.json({ tables })
  } catch (err) {
    console.error('SQLite explorer tables error:', err)
    res.status(500).json({ error: 'Failed to list tables' })
  }
})

sqliteExplorerRouter.get('/:table', (req, res) => {
  const { table } = req.params
  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: `Table '${table}' is not in the allowed list` })
  }

  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ columns: [], rows: [], total: 0 })
    }

    const rawLimit = Number(req.query.limit) || 50
    const limit = Math.min(rawLimit, 200)
    const offset = Number(req.query.offset) || 0

    const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }

    // Get column names from PRAGMA
    const pragmaRows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>
    const columns = pragmaRows.map(r => r.name)

    const rows = db.prepare(
      `SELECT * FROM "${table}" LIMIT ? OFFSET ?`
    ).all(limit, offset) as Array<Record<string, unknown>>

    res.json({ columns, rows, total: totalRow.total })
  } catch (err) {
    console.error('SQLite explorer table error:', err)
    res.status(500).json({ error: 'Failed to query table' })
  }
})
