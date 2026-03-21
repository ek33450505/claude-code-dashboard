import { Router } from 'express'
import { parseRoutingLog, getRoutingStats } from '../parsers/routing.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

const ROUTING_TABLE = path.join(os.homedir(), '.claude', 'config', 'routing-table.json')

export const routingRouter = Router()

// GET /api/routing/stats — summary + recent events
routingRouter.get('/stats', (_req, res) => {
  const events = parseRoutingLog(200)
  res.json(getRoutingStats(events))
})

// GET /api/routing/events — raw event log
routingRouter.get('/events', (req, res) => {
  const parsed = parseInt(String(req.query.limit ?? '50'))
  const limit = Number.isNaN(parsed) ? 50 : Math.max(1, Math.min(parsed, 1000))
  res.json(parseRoutingLog(limit))
})

// GET /api/routing/table — which agents have routing patterns
routingRouter.get('/table', (_req, res) => {
  if (!fs.existsSync(ROUTING_TABLE)) {
    return res.json({ routes: [] })
  }
  try {
    const table = JSON.parse(fs.readFileSync(ROUTING_TABLE, 'utf-8'))
    const routes = (table.routes ?? []).map((r: { agent: string; command: string; patterns: string[] }) => ({
      agent: r.agent,
      command: r.command,
      patternCount: r.patterns?.length ?? 0,
    }))
    res.json({ routes })
  } catch {
    res.json({ routes: [] })
  }
})
