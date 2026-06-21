import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const managedAgentsRouter = Router()

// GET /api/managed-agents
// CAST v8 Managed Agent invocations (cast-managed-agent.sh writer). Empty until used.
managedAgentsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ invocations: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='managed_agent_invocations'"
    ).get()
    if (!tableCheck) return res.json({ invocations: [] })

    const limit = Math.min(Number(req.query.limit) || 200, 1000)

    const invocations = db.prepare(`
      SELECT id, ts, agent_name, mode, http_status, exit_code, session_duration_ms
      FROM managed_agent_invocations
      ORDER BY ts DESC
      LIMIT ?
    `).all(limit)

    return res.json({ invocations })
  } catch (err) {
    console.error('[managed-agents] error:', err)
    return res.json({ invocations: [] })
  }
})
