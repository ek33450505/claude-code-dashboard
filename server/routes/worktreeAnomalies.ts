import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { relativizeHome } from '../utils/relativizeHome.js'
import { clampLimit } from '../utils/clampLimit.js'

export const worktreeAnomaliesRouter = Router()

// GET /api/worktree-anomalies
// CAST v8 git-worktree anomaly detections (cast-subagent-worktree-check.sh writer).
worktreeAnomaliesRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ anomalies: [], total: 0 })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='worktree_anomalies'"
    ).get()
    if (!tableCheck) return res.json({ anomalies: [], total: 0 })

    const limit = clampLimit(req.query.limit, 200, 1000)

    const total = (db.prepare(
      'SELECT COUNT(*) AS cnt FROM worktree_anomalies'
    ).get() as { cnt: number }).cnt

    const rows = db.prepare(`
      SELECT id, agent_id, worktree_path, detected_at, repo_root, state, reason
      FROM worktree_anomalies
      ORDER BY detected_at DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: number; agent_id: string | null; worktree_path: string | null
      detected_at: string; repo_root: string | null; state: string | null; reason: string | null
    }>

    // worktree_path/repo_root are DB columns written by the flagship's worktree
    // checker — absolute paths under $HOME, not derived from os.homedir() here.
    // Relativize on the way out (this GET is public/unauthenticated); nothing
    // downstream reuses these fields for I/O — they only ever flow to res.json.
    const anomalies = rows.map(r => ({
      ...r,
      worktree_path: relativizeHome(r.worktree_path ?? undefined) ?? null,
      repo_root: relativizeHome(r.repo_root ?? undefined) ?? null,
    }))

    return res.json({ anomalies, total })
  } catch (err) {
    console.error('[worktree-anomalies] error:', err)
    return res.json({ anomalies: [], total: 0 })
  }
})
