import fs from 'fs'
import path from 'path'
import os from 'os'
import type { RoutingEvent, RoutingStats } from '../../src/types/index.js'

const ROUTING_LOG = path.join(os.homedir(), '.claude', 'routing-log.jsonl')

export function parseRoutingLog(limit = 100): RoutingEvent[] {
  if (!fs.existsSync(ROUTING_LOG)) return []

  try {
    const lines = fs.readFileSync(ROUTING_LOG, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
      .slice(-limit)

    return lines.map(line => {
      const raw = JSON.parse(line)
      return {
        timestamp: raw.timestamp,
        promptPreview: raw.prompt_preview ?? '',
        action: raw.action ?? 'suggested',
        matchedRoute: raw.matched_route ?? null,
        command: raw.command ?? null,
        pattern: raw.pattern ?? null,
      } satisfies RoutingEvent
    }).reverse()
  } catch {
    return []
  }
}

export function getRoutingStats(events: RoutingEvent[]): RoutingStats {
  // Count dispatched and (legacy) suggested actions — exclude opus escalations and no_match
  const routedCount = events.filter(e =>
    (e.action === 'dispatched' || e.action === 'suggested') &&
    e.matchedRoute &&
    e.matchedRoute !== 'opus'
  ).length
  const agentCounts: Record<string, number> = {}
  for (const e of events) {
    // exclude opus (model escalation signal) consistent with routedCount filter
    if (e.matchedRoute && e.matchedRoute !== 'opus') agentCounts[e.matchedRoute] = (agentCounts[e.matchedRoute] ?? 0) + 1
  }
  const topAgents = Object.entries(agentCounts)
    .map(([agent, count]) => ({ agent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // totalEvents = all prompt events (routed + no_match) — excludes nothing
  // routingRate = routed / (routed + no_match) — the real coverage metric
  const classifiedEvents = events.filter(e => e.action !== 'opus_escalation').length
  return {
    totalEvents: events.length,
    routedCount,
    routingRate: classifiedEvents > 0 ? routedCount / classifiedEvents : 0,
    topAgents,
    recentEvents: events.slice(0, 20),
  }
}
