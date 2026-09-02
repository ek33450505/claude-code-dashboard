import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { relativizeHome } from '../utils/relativizeHome.js'
import { clampLimit } from '../utils/clampLimit.js'

export const compactionEventsRouter = Router()

// GET /api/cast/compaction-events
compactionEventsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ events: [] })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='compaction_events'"
    ).get()
    if (!tableCheck) {
      return res.json({ events: [] })
    }

    const limit = clampLimit(req.query.limit, 100, 500)

    const rows = db.prepare(`
      SELECT
        id,
        session_id,
        timestamp,
        trigger,
        compaction_tier,
        transcript_path
      FROM compaction_events
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as Array<{
      id: string; session_id: string; timestamp: string;
      trigger: string; compaction_tier: string | null; transcript_path: string | null
    }>

    // transcript_path is a DB column populated verbatim from Claude Code's own
    // PreCompact hook payload (an absolute path under ~/.claude/projects/) —
    // relativize on the way out (public, unauthenticated GET). Nothing
    // downstream reuses this field for I/O.
    const events = rows.map(r => ({
      ...r,
      transcript_path: relativizeHome(r.transcript_path ?? undefined) ?? null,
    }))

    res.json({ events })
  } catch (err) {
    console.error('[compaction-events] error:', err)
    res.json({ events: [] })
  }
})
