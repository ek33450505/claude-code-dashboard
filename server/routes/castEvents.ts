import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const castEventsRouter = Router()

const EVENTS_DIR = path.join(os.homedir(), '.claude/cast/events')

// GET /api/cast/events
castEventsRouter.get('/', (req, res) => {
  try {
    if (!fs.existsSync(EVENTS_DIR)) {
      return res.json({ events: [], total: 0 })
    }

    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50, 500)
    const agentFilter = req.query.agent as string | undefined
    const typeFilter = req.query.event_type as string | undefined

    const files = fs.readdirSync(EVENTS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse() // newest first

    let events: Array<Record<string, unknown>> = []
    let total = 0

    for (const file of files) {
      if (events.length >= limit) {
        total = files.length // approximate
        break
      }

      // Parse filename: YYYYMMDDTHHMMSSZ-{agent}-{event-type}.json
      const match = file.match(/^(\d{8}T\d{6}Z)-(.+?)-(.+?)\.json$/)
      const meta = match
        ? { fileTimestamp: match[1], fileAgent: match[2], fileEventType: match[3] }
        : { fileTimestamp: null, fileAgent: null, fileEventType: null }

      // Apply filters on filename metadata before reading file
      if (agentFilter && meta.fileAgent !== agentFilter) continue
      if (typeFilter && meta.fileEventType !== typeFilter) continue

      try {
        const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf-8')
        const parsed = JSON.parse(content)
        events.push({
          _filename: file,
          _fileAgent: meta.fileAgent,
          _fileEventType: meta.fileEventType,
          ...parsed,
        })
      } catch {
        // skip malformed files
      }
    }

    total = total || events.length

    res.json({ events: events.slice(0, limit), total })
  } catch (err) {
    console.error('[cast-events] error:', err)
    res.json({ events: [], total: 0 })
  }
})
