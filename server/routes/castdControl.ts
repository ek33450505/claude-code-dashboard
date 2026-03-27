import { Router } from 'express'
import { execSync } from 'child_process'
import fs from 'fs'
import { CASTD_LOG, CASTD_PID, CASTD_PLIST } from '../constants.js'
import { getCastDb } from './castDb.js'

export const castdControlRouter = Router()

castdControlRouter.get('/status', (_req, res) => {
  try {
    let running = false
    let pid: number | null = null

    if (fs.existsSync(CASTD_PID)) {
      const rawPid = fs.readFileSync(CASTD_PID, 'utf-8').trim()
      const parsedPid = parseInt(rawPid, 10)
      if (!isNaN(parsedPid)) {
        try {
          process.kill(parsedPid, 0)
          running = true
          pid = parsedPid
        } catch {
          // Process not alive
        }
      }
    }

    let queueDepth = 0
    try {
      const db = getCastDb()
      if (db) {
        const row = db.prepare(
          "SELECT COUNT(*) AS cnt FROM task_queue WHERE status = 'pending'"
        ).get() as { cnt: number }
        queueDepth = row?.cnt ?? 0
      }
    } catch { /* non-fatal */ }

    res.json({ running, pid, queueDepth })
  } catch (err) {
    console.error('castd status error:', err)
    res.status(500).json({ error: 'Failed to get castd status' })
  }
})

castdControlRouter.get('/logs', (_req, res) => {
  try {
    if (!fs.existsSync(CASTD_LOG)) {
      return res.json({ lines: [] })
    }
    const content = fs.readFileSync(CASTD_LOG, 'utf-8')
    const lines = content.split('\n').filter(Boolean).slice(-100)
    res.json({ lines })
  } catch (err) {
    console.error('castd logs error:', err)
    res.status(500).json({ error: 'Failed to read castd logs' })
  }
})

castdControlRouter.post('/start', (_req, res) => {
  try {
    if (!fs.existsSync(CASTD_PLIST)) {
      return res.status(400).json({ success: false, error: 'castd plist not found — daemon not installed' })
    }
    execSync(`launchctl load "${CASTD_PLIST}"`, { encoding: 'utf8', timeout: 5000 })
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('castd start error:', message)
    res.status(500).json({ success: false, error: message })
  }
})

castdControlRouter.post('/stop', (_req, res) => {
  try {
    if (!fs.existsSync(CASTD_PLIST)) {
      return res.status(400).json({ success: false, error: 'castd plist not found' })
    }
    execSync(`launchctl unload "${CASTD_PLIST}"`, { encoding: 'utf8', timeout: 5000 })
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('castd stop error:', message)
    res.status(500).json({ success: false, error: message })
  }
})
