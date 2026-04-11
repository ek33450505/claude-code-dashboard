import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const toolFailuresRouter = Router()

const TOOL_FAILURES_PATH = path.join(os.homedir(), '.claude/cast/tool-failures.jsonl')

// GET /api/cast/tool-failures
toolFailuresRouter.get('/', (req, res) => {
  try {
    if (!fs.existsSync(TOOL_FAILURES_PATH)) {
      return res.json({ failures: [], total: 0 })
    }

    const rawLimit = Number(req.query.limit)
    const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 100, 500)
    const since = req.query.since as string | undefined

    const content = fs.readFileSync(TOOL_FAILURES_PATH, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    let failures: Array<Record<string, unknown>> = []
    for (const line of lines) {
      try {
        failures.push(JSON.parse(line))
      } catch {
        // skip malformed lines
      }
    }

    // Filter by since timestamp if provided
    if (since) {
      const sinceDate = new Date(since).getTime()
      failures = failures.filter(f => {
        const ts = f.timestamp as string | undefined
        return ts ? new Date(ts).getTime() >= sinceDate : true
      })
    }

    // Return most recent first, limited
    failures.reverse()
    const total = failures.length
    failures = failures.slice(0, limit)

    res.json({ failures, total })
  } catch (err) {
    console.error('[tool-failures] error:', err)
    res.json({ failures: [], total: 0 })
  }
})

// GET /api/cast/tool-failures/stats
toolFailuresRouter.get('/stats', (_req, res) => {
  try {
    if (!fs.existsSync(TOOL_FAILURES_PATH)) {
      return res.json({ total: 0, byTool: {}, last24h: 0 })
    }

    const content = fs.readFileSync(TOOL_FAILURES_PATH, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)

    const byTool: Record<string, number> = {}
    let last24h = 0
    const cutoff = Date.now() - 24 * 60 * 60 * 1000

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as { tool?: string; timestamp?: string }
        const tool = entry.tool ?? 'unknown'
        byTool[tool] = (byTool[tool] ?? 0) + 1
        if (entry.timestamp && new Date(entry.timestamp).getTime() >= cutoff) {
          last24h++
        }
      } catch {
        // skip
      }
    }

    res.json({ total: lines.length, byTool, last24h })
  } catch (err) {
    console.error('[tool-failures/stats] error:', err)
    res.json({ total: 0, byTool: {}, last24h: 0 })
  }
})
