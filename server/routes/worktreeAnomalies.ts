import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const worktreeAnomaliesRouter = Router()

// GET /api/worktree-anomalies
// CAST v8 git-worktree anomaly detections (cast-subagent-worktree-check.sh writer).
worktreeAnomaliesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ anomalies: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='worktree_anomalies'"
    ).get()
    if (!tableCheck) return res.json({ anomalies: [] })

    const limit = Math.min(Number(req.query.limit) || 200, 1000)

    const anomalies = db.prepare(`
      SELECT id, agent_id, worktree_path, detected_at, repo_root, state, reason
      FROM worktree_anomalies
      ORDER BY detected_at DESC
      LIMIT ?
    `).all(limit)

    return res.json({ anomalies })
  } catch (err) {
    console.error('[worktree-anomalies] error:', err)
    return res.json({ anomalies: [] })
  }
})
