import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const swarmRouter = Router()

// ── GET /api/swarm/sessions ───────────────────────────────────────────────────

swarmRouter.get('/sessions', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ sessions: [] })
    }

    // Guard: table may not exist yet on older cast.db installs
    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.json({ sessions: [] })
    }

    const sessions = db.prepare(`
      SELECT
        ss.*,
        COUNT(tr.id) AS teammate_count,
        COALESCE(SUM(tr.tokens_in + tr.tokens_out), 0) AS total_tokens
      FROM swarm_sessions ss
      LEFT JOIN teammate_runs tr ON tr.swarm_id = ss.id
      GROUP BY ss.id
      ORDER BY ss.started_at DESC
      LIMIT 50
    `).all() as Array<Record<string, unknown>>

    res.json({ sessions })
  } catch (err) {
    console.error('Swarm sessions error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm sessions' })
  }
})

// ── GET /api/swarm/sessions/:id ───────────────────────────────────────────────

swarmRouter.get('/sessions/:id', (req, res) => {
  if (!req.params.id?.trim()) return res.status(400).json({ error: 'Missing id' })
  try {
    const db = getCastDb()
    if (!db) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const session = db.prepare(
      `SELECT * FROM swarm_sessions WHERE id = ?`
    ).get(req.params.id) as Record<string, unknown> | undefined

    if (!session) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const teammates = db.prepare(
      `SELECT * FROM teammate_runs WHERE swarm_id = ? ORDER BY started_at ASC`
    ).all(req.params.id) as Array<Record<string, unknown>>

    res.json({ session, teammates })
  } catch (err) {
    console.error('Swarm session detail error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm session' })
  }
})

// ── GET /api/swarm/sessions/:id/messages ─────────────────────────────────────

swarmRouter.get('/sessions/:id/messages', (req, res) => {
  if (!req.params.id?.trim()) return res.status(400).json({ error: 'Missing id' })
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ messages: [] })
    }

    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.json({ messages: [] })
    }

    // 404 if swarm doesn't exist
    const session = db.prepare(
      `SELECT id FROM swarm_sessions WHERE id = ?`
    ).get(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const messages = db.prepare(`
      SELECT * FROM teammate_messages
      WHERE swarm_id = ?
      ORDER BY timestamp DESC
      LIMIT 200
    `).all(req.params.id) as Array<Record<string, unknown>>

    res.json({ messages })
  } catch (err) {
    console.error('Swarm messages error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm messages' })
  }
})

