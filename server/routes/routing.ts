import { Router } from 'express'
import { parseRoutingLog, getRoutingStats } from '../parsers/routing.js'
import { getRecentAgentDispatches } from '../parsers/agentDispatches.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

const ROUTING_TABLE = path.join(os.homedir(), '.claude', 'config', 'routing-table.json')

export const routingRouter = Router()

// GET /api/routing/stats — summary + recent events
routingRouter.get('/stats', (_req, res) => {
  const routingEvents = parseRoutingLog(200)
  const dispatchEvents = getRecentAgentDispatches(50)
  // Merge both sources by timestamp (newest first)
  const events = [...routingEvents, ...dispatchEvents]
    .sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
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
    const routes = (table.routes ?? []).map((r: { agent: string; command: string; patterns: string[]; postChain?: string[] }) => ({
      agent: r.agent,
      command: r.command,
      patternCount: r.patterns?.length ?? 0,
      patterns: r.patterns ?? [],
      postChain: r.postChain ?? null,
    }))
    res.json({ routes })
  } catch {
    res.json({ routes: [] })
  }
})
