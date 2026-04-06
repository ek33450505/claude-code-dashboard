import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const qualityGatesRouter = Router()
export const dispatchDecisionsRouter = Router()

// GET /api/quality-gates
qualityGatesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ gates: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ gates: [] })
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const agent = req.query.agent as string | undefined
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('agent_name = ?'); params.push(agent) }
    if (since) { conditions.push('timestamp >= ?'); params.push(since) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const gates = db.prepare(`
      SELECT
        id,
        session_id,
        batch_id,
        agent_name,
        timestamp,
        status_line,
        contract_passed,
        retry_count
      FROM quality_gates
      ${where}
      ORDER BY timestamp DESC
      LIMIT ?
    `).all([...params, limit])

    return res.json({ gates })
  } catch (err) {
    console.error('[quality-gates] error:', err)
    return res.json({ gates: [] })
  }
})

// GET /api/quality-gates/stats
qualityGatesRouter.get('/stats', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, retry_distribution: {} })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, retry_distribution: {} })
    }

    const totalRow = db.prepare(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN contract_passed = 1 THEN 1 ELSE 0 END) AS passed FROM quality_gates'
    ).get() as { total: number; passed: number }

    const total = totalRow.total
    const pass_rate = total > 0 ? Math.round((totalRow.passed / total) * 100) : 0

    // Per-agent stats
    const agentRows = db.prepare(`
      SELECT
        agent_name,
        COUNT(*) AS total,
        SUM(CASE WHEN contract_passed = 1 THEN 1 ELSE 0 END) AS passed
      FROM quality_gates
      GROUP BY agent_name
    `).all() as Array<{ agent_name: string; total: number; passed: number }>

    const by_agent: Record<string, { total: number; passed: number; rate: number }> = {}
    for (const row of agentRows) {
      by_agent[row.agent_name] = {
        total: row.total,
        passed: row.passed,
        rate: row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0,
      }
    }

    // Retry distribution
    const retryRows = db.prepare(`
      SELECT retry_count, COUNT(*) AS cnt FROM quality_gates GROUP BY retry_count
    `).all() as Array<{ retry_count: number; cnt: number }>

    const retry_distribution: Record<number, number> = {}
    for (const row of retryRows) {
      retry_distribution[row.retry_count] = row.cnt
    }

    return res.json({ total, pass_rate, by_agent, retry_distribution })
  } catch (err) {
    console.error('[quality-gates/stats] error:', err)
    return res.json({ total: 0, pass_rate: 0, by_agent: {}, retry_distribution: {} })
  }
})

// GET /api/dispatch-decisions
dispatchDecisionsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ decisions: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dispatch_decisions'"
    ).get()
    if (!tableCheck) {
      return res.json({ decisions: [] })
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500)

    const decisions = db.prepare(`
      SELECT
        id,
        session_id,
        timestamp,
        dispatch_backend,
        plan_file
      FROM dispatch_decisions
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit)

    return res.json({ decisions })
  } catch (err) {
    console.error('[dispatch-decisions] error:', err)
    return res.json({ decisions: [] })
  }
})
