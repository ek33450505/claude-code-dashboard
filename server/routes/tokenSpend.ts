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
        date(started_at) AS date,
        SUM(total_input_tokens) AS inputTokens,
        SUM(total_output_tokens) AS outputTokens,
        SUM(total_cost_usd) AS costUsd
      FROM sessions
      WHERE date(started_at) >= ?
      GROUP BY date(started_at)
      ORDER BY date(started_at) ASC
    `).all(cutoffStr) as Array<{ date: string; inputTokens: number; outputTokens: number; costUsd: number }>

    const totalsRow = db.prepare(`
      SELECT
        COUNT(*) AS sessionCount,
        COALESCE(SUM(total_input_tokens), 0) AS inputTokens,
        COALESCE(SUM(total_output_tokens), 0) AS outputTokens,
        COALESCE(SUM(total_cost_usd), 0) AS costUsd
      FROM sessions
      WHERE date(started_at) >= ?
    `).get(cutoffStr) as { sessionCount: number; inputTokens: number; outputTokens: number; costUsd: number }

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
