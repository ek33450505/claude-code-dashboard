import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const agentRunsRouter = Router()

agentRunsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        runs: [],
        stats: { totalRuns: 0, totalCostUsd: 0, byAgent: {}, byStatus: {} },
      })
    }

    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const agent = req.query.agent as string | undefined
    const status = req.query.status as string | undefined
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('ar.agent = ?'); params.push(agent) }
    if (status) { conditions.push('ar.status = ?'); params.push(status) }
    if (since) { conditions.push('ar.started_at >= ?'); params.push(since) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const runs = db.prepare(`
      SELECT
        ar.id,
        ar.session_id,
        ar.agent,
        ar.model,
        ar.started_at,
        ar.ended_at,
        ar.status,
        ar.input_tokens,
        ar.output_tokens,
        ar.cost_usd,
        ar.task_summary,
        s.project
      FROM agent_runs ar
      LEFT JOIN sessions s ON s.id = ar.session_id
      ${where}
      ORDER BY ar.started_at DESC
      LIMIT ?
    `).all([...params, limit]) as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      task_summary: string | null; project: string | null
    }>

    // Aggregate stats (no filter for overall stats)
    const statsRow = db.prepare(`
      SELECT
        COUNT(*) AS totalRuns,
        COALESCE(SUM(cost_usd), 0) AS totalCostUsd
      FROM agent_runs
    `).get() as { totalRuns: number; totalCostUsd: number }

    const byAgentRows = db.prepare(`
      SELECT agent, COUNT(*) AS cnt FROM agent_runs GROUP BY agent
    `).all() as Array<{ agent: string; cnt: number }>

    const byStatusRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM agent_runs GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>

    const byAgent: Record<string, number> = {}
    for (const r of byAgentRows) byAgent[r.agent] = r.cnt

    const byStatus: Record<string, number> = {}
    for (const r of byStatusRows) byStatus[r.status] = r.cnt

    res.json({
      runs,
      stats: {
        totalRuns: statsRow.totalRuns,
        totalCostUsd: statsRow.totalCostUsd,
        byAgent,
        byStatus,
      },
    })
  } catch (err) {
    console.error('Agent runs error:', err)
    res.status(500).json({ error: 'Failed to fetch agent runs' })
  }
})
