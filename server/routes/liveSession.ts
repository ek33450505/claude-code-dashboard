import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import os from 'os'

export const liveSessionRouter = Router()

const LOGS_DIR = path.join(os.homedir(), '.claude', 'logs')
const KEEPALIVE_INTERVAL_MS = 15_000
const POLL_INTERVAL_MS = 2_000

/** Find the most recently modified *.jsonl file in ~/.claude/logs/ */
function findLatestJsonlFile(): string | null {
  if (!fs.existsSync(LOGS_DIR)) return null

  let latest: string | null = null
  let latestMtime = 0

  try {
    const files = fs.readdirSync(LOGS_DIR)
    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const filePath = path.join(LOGS_DIR, file)
      try {
        const stat = fs.statSync(filePath)
        if (stat.mtimeMs > latestMtime) {
          latestMtime = stat.mtimeMs
          latest = filePath
        }
      } catch { /* skip unreadable */ }
    }
  } catch { /* ignore */ }

  return latest
}

/** Parse a raw JSONL line into a structured SSE event payload */
function parseLine(raw: string): { timestamp: string; tool_name: string | null; agent: string | null; event_type: string } | null {
  try {
    const parsed = JSON.parse(raw)
    return {
      timestamp: parsed.timestamp ?? new Date().toISOString(),
      tool_name: parsed.tool_name ?? parsed.toolName ?? null,
      agent: parsed.agent ?? parsed.agentType ?? null,
      event_type: parsed.type ?? parsed.event_type ?? 'unknown',
    }
  } catch {
    return null
  }
}

liveSessionRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const logFile = findLatestJsonlFile()

  if (!logFile) {
    res.write(`data: ${JSON.stringify({ connected: false })}\n\n`)
    res.end()
    return
  }

  let filePosition = fs.existsSync(logFile) ? fs.statSync(logFile).size : 0
  let lastEventAt = Date.now()

  const pollInterval = setInterval(() => {
    try {
      const stat = fs.statSync(logFile)
      if (stat.size <= filePosition) {
        // No new bytes — check if we need a keepalive comment
        if (Date.now() - lastEventAt >= KEEPALIVE_INTERVAL_MS) {
          res.write(': keepalive\n\n')
          lastEventAt = Date.now()
        }
        return
      }

      const fd = fs.openSync(logFile, 'r')
      const length = stat.size - filePosition
      const buf = Buffer.alloc(length)
      fs.readSync(fd, buf, 0, length, filePosition)
      fs.closeSync(fd)
      filePosition = stat.size

      const text = buf.toString('utf-8')
      const lines = text.split('\n').filter(l => l.trim().length > 0)

      for (const line of lines) {
        const payload = parseLine(line)
        if (payload) {
          res.write(`data: ${JSON.stringify(payload)}\n\n`)
          lastEventAt = Date.now()
        }
      }
    } catch {
      // File may have rotated or been removed — stop polling
      clearInterval(pollInterval)
      res.end()
    }
  }, POLL_INTERVAL_MS)

  req.on('close', () => {
    clearInterval(pollInterval)
  })
})
