import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const budgetStatusRouter = Router()

// GET /api/budget/status
budgetStatusRouter.get('/status', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ today_spend: 0, daily_limit: null, pct_used: null, over_budget: false })

    const today = new Date().toISOString().slice(0, 10)
    const spendRow = db.prepare(`
      SELECT COALESCE(SUM(total_cost_usd), 0) AS spend
      FROM sessions WHERE date(started_at) = ?
    `).get(today) as { spend: number }
    const today_spend = spendRow?.spend ?? 0

    const budgetRow = db.prepare(`
      SELECT limit_usd FROM budgets
      WHERE scope = 'global' AND scope_key = 'global' AND period = 'daily'
      ORDER BY id DESC LIMIT 1
    `).get() as { limit_usd: number } | undefined

    if (!budgetRow) {
      return res.json({ today_spend, daily_limit: null, pct_used: null, over_budget: false })
    }

    const daily_limit = budgetRow.limit_usd
    const pct_used = daily_limit > 0 ? Math.round((today_spend / daily_limit) * 1000) / 10 : null
    const over_budget = daily_limit > 0 && today_spend > daily_limit

    res.json({ today_spend, daily_limit, pct_used, over_budget })
  } catch (err) {
    console.error('Budget status error:', err)
    res.status(500).json({ error: 'Failed to fetch budget status' })
  }
})

// POST /api/budget/config
budgetStatusRouter.post('/config', (req, res) => {
  try {
    const { daily_limit_usd } = req.body as { daily_limit_usd?: unknown }

    if (typeof daily_limit_usd !== 'number' || daily_limit_usd < 0) {
      return res.status(400).json({ error: 'daily_limit_usd must be a non-negative number' })
    }

    const db = getCastDb()
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    const now = new Date().toISOString()
    // Upsert: delete existing global daily budget then insert fresh row
    db.prepare(`DELETE FROM budgets WHERE scope = 'global' AND scope_key = 'global' AND period = 'daily'`).run()
    db.prepare(`
      INSERT INTO budgets (scope, scope_key, period, limit_usd, alert_at_pct, created_at)
      VALUES ('global', 'global', 'daily', ?, 0.80, ?)
    `).run(daily_limit_usd, now)

    res.json({ ok: true, daily_limit_usd })
  } catch (err) {
    console.error('Budget config write error:', err)
    res.status(500).json({ error: 'Failed to save budget config' })
  }
})
