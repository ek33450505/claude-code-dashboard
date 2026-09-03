import { Router } from 'express'
import { getCastDb, getCastDbWritable } from './castDb.js'
import { tableExists } from '../utils/tableExists.js'
import { clampLimit } from '../utils/clampLimit.js'

export const paneBindingsRouter = Router()

interface PaneBindingRow {
  pane_id: string; session_id: string | null;
  started_at: number | null; ended_at: number | null; project_path: string | null
}

// GET /api/pane-bindings — "what's running where" list. Read-only, so controlGate
// (mounted on /api/pane-bindings for the POST side) lets this straight through.
paneBindingsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ bindings: [] })
    if (!tableExists(db, 'pane_bindings')) return res.json({ bindings: [] })

    const limit = clampLimit(req.query.limit, 50, 200)
    const bindings = db.prepare(`
      SELECT pane_id, session_id, started_at, ended_at, project_path
      FROM pane_bindings
      ORDER BY started_at DESC
      LIMIT ?
    `).all(limit) as PaneBindingRow[]

    res.json({ bindings })
  } catch (err) {
    console.error('[pane-bindings] GET error:', err)
    res.json({ bindings: [] })
  }
})

// POST /api/pane-bindings/notify — called by the flagship's
// cast-session-start-hook.sh on every session start. Upserts by pane_id;
// started_at is set only on first insert (epoch SECONDS — format D, never ISO)
// and deliberately excluded from the ON CONFLICT SET list so a repeat notify for
// the same pane doesn't reset its start time.
paneBindingsRouter.post('/notify', (req, res) => {
  const { pane_id, session_id, project_path } = req.body as {
    pane_id?: unknown; session_id?: unknown; project_path?: unknown
  }

  if (typeof pane_id !== 'string' || pane_id.length === 0) {
    return res.status(400).json({ error: 'pane_id is required and must be a non-empty string' })
  }
  const sessionId = typeof session_id === 'string' ? session_id : null
  const projectPath = typeof project_path === 'string' ? project_path : null

  let db: ReturnType<typeof getCastDbWritable> = null
  try {
    db = getCastDbWritable()
    if (!db) return res.status(503).json({ error: 'Database unavailable' })

    if (!tableExists(db, 'pane_bindings')) {
      return res.status(503).json({ error: 'pane_bindings table not found — run cast-db-init.sh to initialise schema' })
    }

    const startedAt = Math.floor(Date.now() / 1000)
    db.prepare(`
      INSERT INTO pane_bindings (pane_id, session_id, started_at, project_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(pane_id) DO UPDATE SET
        session_id = excluded.session_id,
        project_path = excluded.project_path
    `).run(pane_id, sessionId, startedAt, projectPath)

    res.json({ ok: true, pane_id })
  } catch (err) {
    console.error('[pane-bindings] notify error:', err)
    res.status(500).json({ error: 'Failed to record pane binding' })
  } finally {
    if (db) db.close()
  }
})
