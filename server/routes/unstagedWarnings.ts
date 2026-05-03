import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const unstagedWarningsRouter = Router()

export interface UnstagedWarning {
  id: number
  timestamp: string
  file_path: string | null
  agent: string | null
}

unstagedWarningsRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ warnings: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='unstaged_warnings'"
    ).get()
    if (!tableCheck) return res.json({ warnings: [] })

    const warnings = db.prepare(
      'SELECT id, timestamp, file_path, agent FROM unstaged_warnings ORDER BY timestamp DESC LIMIT 20'
    ).all()

    return res.json({ warnings })
  } catch (err) {
    console.error('[unstaged-warnings] error:', err)
    return res.json({ warnings: [] })
  }
})
