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

/**
 * Filter out prompts that don't qualify for agent routing stats.
 * Slash commands (e.g., /review, /plan) use the command router, not keyword routing.
 * Short conversational prompts (<=3 words) are excluded to reduce noise in miss rate.
 */
function isTrivialPrompt(preview: string): boolean {
  const trimmed = preview.trim().toLowerCase()
  if (!trimmed) return true
  // Slash commands are handled by the command system, not keyword routing
  if (trimmed.startsWith('/')) return true
  // Short prompts (≤3 words) are typically conversational
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount <= 3) return true
  // Common conversational acknowledgements
  const trivial = [
    'ok', 'yes', 'no', 'push', 'done', 'thanks', 'lgtm',
    'please resume', 'keep as is', 'sounds good', 'looks good',
    'perfect', 'great', 'continue', 'go ahead', 'approved',
  ]
  return trivial.some(p => trimmed === p || trimmed.startsWith(p + ' '))
}

export function getRoutingStats(events: RoutingEvent[]): RoutingStats {
  // Separate routing-log events (user prompts) from agent dispatches (internal)
  const promptEvents = events.filter(e => e.action !== 'agent_dispatch')
  const autoEvents = events.filter(e => e.action === 'agent_dispatch')

  // routedCount = hook-dispatched prompts only (not auto dispatches)
  const routedCount = promptEvents.filter(e =>
    (e.action === 'dispatched' || e.action === 'suggested') &&
    e.matchedRoute &&
    e.matchedRoute !== 'opus'
  ).length

  // Agent counts include both sources for the leaderboard
  const agentCounts: Record<string, { total: number; routed: number; direct: number }> = {}
  for (const e of events) {
    if (e.matchedRoute && e.matchedRoute !== 'opus') {
      if (!agentCounts[e.matchedRoute]) agentCounts[e.matchedRoute] = { total: 0, routed: 0, direct: 0 }
      agentCounts[e.matchedRoute].total++
      if (e.action === 'agent_dispatch') {
        agentCounts[e.matchedRoute].direct++
      } else {
        agentCounts[e.matchedRoute].routed++
      }
    }
  }
  const topAgents = Object.entries(agentCounts)
    .map(([agent, { total, routed, direct }]) => ({ agent, count: total, routed, direct }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Coverage rate: filter out trivial prompts before computing miss/hit ratio
  const substantivePrompts = promptEvents.filter(e =>
    e.action !== 'opus_escalation' && !isTrivialPrompt(e.promptPreview ?? '')
  )
  const substantiveRouted = substantivePrompts.filter(e =>
    (e.action === 'dispatched' || e.action === 'suggested') &&
    e.matchedRoute &&
    e.matchedRoute !== 'opus'
  ).length

  return {
    totalEvents: promptEvents.length,
    routedCount,
    autoDispatchCount: autoEvents.length,
    routingRate: substantivePrompts.length > 0 ? substantiveRouted / substantivePrompts.length : 0,
    topAgents,
    recentEvents: events.slice(0, 20),
  }
}
