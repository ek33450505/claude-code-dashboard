import { Router } from 'express'
import { parseRoutingLog, getRoutingStats } from '../parsers/routing.js'

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
