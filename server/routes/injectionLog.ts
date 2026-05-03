import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const injectionLogRouter = Router()

export interface InjectionLogEntry {
  id: number
  timestamp: string
  hook_type: string | null
  content_preview: string | null
}

injectionLogRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ entries: [] })

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='injection_log'"
    ).get()
    if (!tableCheck) return res.json({ entries: [] })

    const entries = db.prepare(
      'SELECT id, timestamp, hook_type, content_preview FROM injection_log ORDER BY timestamp DESC LIMIT 100'
    ).all()

    return res.json({ entries })
  } catch (err) {
    console.error('[injection-log] error:', err)
    return res.json({ entries: [] })
  }
})
