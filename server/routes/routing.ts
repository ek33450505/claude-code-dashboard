import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const routingRouter = Router()

// GET /api/routing/events?limit=N — query agent_runs table from cast.db
routingRouter.get('/events', (req, res) => {
  const parsed = parseInt(String(req.query.limit ?? '100'))
  const limit = Number.isNaN(parsed) ? 100 : Math.max(1, Math.min(parsed, 1000))

  try {
    const db = getCastDb()
    if (!db) {
      return res.json([])
    }

    let rows: unknown[] = []
    try {
      rows = db.prepare(`
        SELECT id, session_id, agent, status, started_at,
               ended_at AS completed_at,
               CAST((julianday(ended_at) - julianday(started_at)) * 86400000 AS INTEGER) AS duration_ms,
               task_summary AS prompt_preview, cost_usd
        FROM agent_runs
        ORDER BY started_at DESC
        LIMIT ?
      `).all(limit)
    } catch {
      // Table may not exist yet
      return res.json([])
    }

    res.json(rows)
  } catch (err) {
    console.error('routing events error:', err)
    res.json([])
  }
})

// GET /api/routing/stats — aggregate counts from agent_runs
routingRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ total: 0, byStatus: {}, topAgent: null, last24hCount: 0 })
    }

    let total = 0
    let byStatus: Record<string, number> = {}
    let topAgent: string | null = null
    let last24hCount = 0

    try {
      const totalRow = db.prepare('SELECT COUNT(*) AS cnt FROM agent_runs').get() as { cnt: number }
      total = totalRow?.cnt ?? 0

      const statusRows = db.prepare(
        'SELECT status, COUNT(*) AS cnt FROM agent_runs GROUP BY status'
      ).all() as Array<{ status: string; cnt: number }>
      byStatus = Object.fromEntries(statusRows.map(r => [r.status, r.cnt]))

      const topRow = db.prepare(
        'SELECT agent, COUNT(*) AS cnt FROM agent_runs GROUP BY agent ORDER BY cnt DESC LIMIT 1'
      ).get() as { agent: string; cnt: number } | undefined
      topAgent = topRow?.agent ?? null

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const last24Row = db.prepare(
        'SELECT COUNT(*) AS cnt FROM agent_runs WHERE started_at >= ?'
      ).get(since) as { cnt: number }
      last24hCount = last24Row?.cnt ?? 0
    } catch {
      // Table may not exist yet — return zeros
    }

    res.json({ total, byStatus, topAgent, last24hCount })
  } catch (err) {
    console.error('routing stats error:', err)
    res.json({ total: 0, byStatus: {}, topAgent: null, last24hCount: 0 })
  }
})
