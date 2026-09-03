import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { tableExists } from '../utils/tableExists.js'
import { clampLimit } from '../utils/clampLimit.js'

export const agentRunsDailyRouter = Router()
export const mcpCallsDailyRouter = Router()

interface AgentRunsDailyRow {
  day: string; runs: number; cost_usd: number;
  input_tokens: number; output_tokens: number; duration_ms: number
}

// GET /api/cast/agent-runs-daily?days=N
// Reads ONLY agent_runs_daily — never UNION with raw agent_runs. The rollup table
// already covers every day including today (partial, see is_partial below); a
// union with agent_runs would double-count rows the nightly job has already summed.
agentRunsDailyRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ days: [] })
    if (!tableExists(db, 'agent_runs_daily')) return res.json({ days: [] })

    const days = clampLimit(req.query.days, 30, 90)
    const today = new Date().toISOString().slice(0, 10)

    const rows = db.prepare(`
      SELECT
        day,
        SUM(runs) AS runs,
        SUM(cost_usd) AS cost_usd,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(duration_ms) AS duration_ms
      FROM agent_runs_daily
      WHERE day >= date('now', '-' || ? || ' days')
      GROUP BY day
      ORDER BY day ASC
    `).all(days) as AgentRunsDailyRow[]

    // Per-run average MUST be sum/sum, never AVG(cost_usd) — rows in agent_runs_daily
    // are already pre-aggregated per day/agent/model/status, so AVG would average
    // already-summed buckets instead of dividing the true totals.
    const mapped = rows.map((r) => ({
      ...r,
      avg_cost_per_run: r.runs > 0 ? r.cost_usd / r.runs : null,
      // The nightly rollup job runs ~03:30, so today's row is always incomplete
      // until then — flag it rather than let it read as a real low-activity day.
      is_partial: r.day === today,
    }))

    res.json({ days: mapped })
  } catch (err) {
    console.error('[agent-runs-daily] error:', err)
    res.json({ days: [] })
  }
})

interface McpCallsDailyRow {
  day: string; mcp_server: string; is_cloud_bound: number;
  calls: number; result_bytes: number
}

// GET /api/cast/mcp-calls-daily?days=N
// Reads ONLY mcp_calls_daily — same no-union rule as agent-runs-daily above.
mcpCallsDailyRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ days: [] })
    if (!tableExists(db, 'mcp_calls_daily')) return res.json({ days: [] })

    const days = clampLimit(req.query.days, 30, 90)
    const today = new Date().toISOString().slice(0, 10)

    const rows = db.prepare(`
      SELECT
        day,
        mcp_server,
        is_cloud_bound,
        SUM(calls) AS calls,
        SUM(result_bytes) AS result_bytes
      FROM mcp_calls_daily
      WHERE day >= date('now', '-' || ? || ' days')
      GROUP BY day, mcp_server, is_cloud_bound
      ORDER BY day ASC
    `).all(days) as McpCallsDailyRow[]

    const mapped = rows.map((r) => ({
      ...r,
      is_partial: r.day === today,
    }))

    res.json({ days: mapped })
  } catch (err) {
    console.error('[mcp-calls-daily] error:', err)
    res.json({ days: [] })
  }
})
