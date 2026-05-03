import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const agentTruncationsRouter = Router()

export interface AgentTruncation {
  id: number
  timestamp: string
  agent: string | null
  model: string | null
  truncated_at: string | null
}

agentTruncationsRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ truncations: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_truncations'"
    ).get()
    if (!tableCheck) return res.json({ truncations: [] })

    const truncations = db.prepare(
      'SELECT id, timestamp, agent, model, truncated_at FROM agent_truncations ORDER BY timestamp DESC LIMIT 50'
    ).all()

    return res.json({ truncations })
  } catch (err) {
    console.error('[agent-truncations] error:', err)
    return res.json({ truncations: [] })
  }
})
