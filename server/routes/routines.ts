import { Router } from 'express'
import { getCastDb } from './castDb.js'
import { relativizeHome } from '../utils/relativizeHome.js'

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent_to_dispatch: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

export const routinesRouter = Router()

routinesRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ routines: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='routines'"
    ).get()
    if (!tableCheck) return res.json({ routines: [] })

    const rows = db.prepare(`
      SELECT id, name, trigger_type, trigger_value, agent_to_dispatch,
             enabled, last_run_at, last_run_status, last_run_output_path, created_at
      FROM routines
      ORDER BY name ASC
    `).all() as RoutineRow[]

    // last_run_output_path is a DB column written under ~/.claude/routines-output/
    // by the flagship's routine runner — relativize on the way out (public,
    // unauthenticated GET). Nothing downstream reuses this field for I/O.
    const routines = rows.map(r => ({
      ...r,
      last_run_output_path: relativizeHome(r.last_run_output_path ?? undefined) ?? null,
    }))

    return res.json({ routines })
  } catch (err) {
    console.error('[routines] error:', err)
    return res.json({ routines: [] })
  }
})
