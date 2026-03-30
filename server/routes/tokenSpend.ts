import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const tokenSpendRouter = Router()

tokenSpendRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        daily: [],
        totals: { inputTokens: 0, outputTokens: 0, costUsd: 0, sessionCount: 0 },
      })
    }

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const daily = db.prepare(`
      SELECT
        date,
        SUM(inputTokens) AS inputTokens,
        SUM(outputTokens) AS outputTokens,
        SUM(costUsd) AS costUsd
      FROM (
        SELECT
          date(started_at) AS date,
          COALESCE(total_input_tokens, 0) AS inputTokens,
          COALESCE(total_output_tokens, 0) AS outputTokens,
          COALESCE(total_cost_usd, 0) AS costUsd
        FROM sessions
        WHERE date(started_at) >= ?
        UNION ALL
        SELECT
          date(started_at) AS date,
          COALESCE(input_tokens, 0) AS inputTokens,
          COALESCE(output_tokens, 0) AS outputTokens,
          COALESCE(cost_usd, 0) AS costUsd
        FROM agent_runs
        WHERE date(started_at) >= ?
      )
      GROUP BY date
      ORDER BY date ASC
    `).all(cutoffStr, cutoffStr) as Array<{ date: string; inputTokens: number; outputTokens: number; costUsd: number }>

    const totalsRow = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sessions WHERE date(started_at) >= ?) AS sessionCount,
        COALESCE((SELECT SUM(total_input_tokens) FROM sessions WHERE date(started_at) >= ?), 0)
          + COALESCE((SELECT SUM(input_tokens) FROM agent_runs WHERE date(started_at) >= ?), 0) AS inputTokens,
        COALESCE((SELECT SUM(total_output_tokens) FROM sessions WHERE date(started_at) >= ?), 0)
          + COALESCE((SELECT SUM(output_tokens) FROM agent_runs WHERE date(started_at) >= ?), 0) AS outputTokens,
        COALESCE((SELECT SUM(total_cost_usd) FROM sessions WHERE date(started_at) >= ?), 0)
          + COALESCE((SELECT SUM(cost_usd) FROM agent_runs WHERE date(started_at) >= ?), 0) AS costUsd
    `).get(cutoffStr, cutoffStr, cutoffStr, cutoffStr, cutoffStr, cutoffStr, cutoffStr) as { sessionCount: number; inputTokens: number; outputTokens: number; costUsd: number }

    res.json({
      daily,
      totals: {
        inputTokens: totalsRow.inputTokens ?? 0,
        outputTokens: totalsRow.outputTokens ?? 0,
        costUsd: totalsRow.costUsd ?? 0,
        sessionCount: totalsRow.sessionCount ?? 0,
      },
    })
  } catch (err) {
    console.error('Token spend error:', err)
    res.status(500).json({ error: 'Failed to fetch token spend data' })
  }
})
