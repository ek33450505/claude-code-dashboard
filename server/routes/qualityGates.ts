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
    const until = req.query.until as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('agent = ?'); params.push(agent) }
    if (since) { conditions.push('created_at >= ?'); params.push(since) }
    if (until) { conditions.push('created_at <= ?'); params.push(until) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const gates = db.prepare(`
      SELECT
        id,
        session_id,
        agent,
        gate_type,
        gate_result,
        feedback,
        artifact_count,
        created_at
      FROM quality_gates
      ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `).all([...params, limit])

    return res.json({ gates })
  } catch (err) {
    console.error('[quality-gates] error:', err)
    return res.json({ gates: [] })
  }
})

// GET /api/quality-gates/stats
qualityGatesRouter.get('/stats', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_gate_type: {} })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_gate_type: {} })
    }

    const since = req.query.since as string | undefined
    const until = req.query.until as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []
    if (since) { conditions.push('created_at >= ?'); params.push(since) }
    if (until) { conditions.push('created_at <= ?'); params.push(until) }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const totalRow = db.prepare(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN gate_result = 'pass' THEN 1 ELSE 0 END) AS passed FROM quality_gates ${where}`
    ).get(...params) as { total: number; passed: number }

    const total = totalRow.total
    const pass_rate = total > 0 ? Math.round((totalRow.passed / total) * 100) : 0

    // Per-agent stats
    const agentRows = db.prepare(`
      SELECT
        agent,
        COUNT(*) AS total,
        SUM(CASE WHEN gate_result = 'pass' THEN 1 ELSE 0 END) AS passed
      FROM quality_gates
      ${where}
      GROUP BY agent
    `).all(...params) as Array<{ agent: string; total: number; passed: number }>

    const by_agent: Record<string, { total: number; passed: number; rate: number }> = {}
    for (const row of agentRows) {
      by_agent[row.agent] = {
        total: row.total,
        passed: row.passed,
        rate: row.total > 0 ? Math.round((row.passed / row.total) * 100) : 0,
      }
    }

    // Per-gate-type stats
    const gateTypeRows = db.prepare(`
      SELECT gate_type, COUNT(*) AS cnt FROM quality_gates ${where} GROUP BY gate_type
    `).all(...params) as Array<{ gate_type: string; cnt: number }>

    const by_gate_type: Record<string, number> = {}
    for (const row of gateTypeRows) {
      by_gate_type[row.gate_type] = row.cnt
    }

    return res.json({ total, pass_rate, by_agent, by_gate_type })
  } catch (err) {
    console.error('[quality-gates/stats] error:', err)
    return res.json({ total: 0, pass_rate: 0, by_agent: {}, by_gate_type: {} })
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
        prompt_snippet,
        chosen_agent,
        model,
        effort,
        wave_id,
        parallel,
        created_at
      FROM dispatch_decisions
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit)

    return res.json({ decisions })
  } catch (err) {
    console.error('[dispatch-decisions] error:', err)
    return res.json({ decisions: [] })
  }
})
