import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const qualityGatesRouter = Router()
export const dispatchDecisionsRouter = Router()

// GET /api/quality-gates
// Returns recent quality gate events (pass/block/warn) from cast.db
qualityGatesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ gates: [] })
    }

    // Check table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='quality_gates'"
    ).get()
    if (!tableCheck) {
      return res.json({ gates: [] })
    }

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
      ORDER BY created_at DESC
      LIMIT 100
    `).all()

    return res.json({ gates })
  } catch (err) {
    console.error('[quality-gates] error:', err)
    return res.json({ gates: [] })
  }
})

// GET /api/dispatch-decisions
// Returns recent agent dispatch decisions from cast.db
dispatchDecisionsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ decisions: [] })
    }

    // Check table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='dispatch_decisions'"
    ).get()
    if (!tableCheck) {
      return res.json({ decisions: [] })
    }

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
      LIMIT 100
    `).all()

    return res.json({ decisions })
  } catch (err) {
    console.error('[dispatch-decisions] error:', err)
    return res.json({ decisions: [] })
  }
})
