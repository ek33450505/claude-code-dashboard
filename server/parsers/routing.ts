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
 *
 * The routing hook fires on ALL user messages, but only work-task prompts
 * belong in the coverage denominator. Conversational replies, session
 * management, and slash commands are excluded so the miss rate reflects
 * actual routing gaps — prompts that SHOULD have matched a pattern but didn't.
 */
function isNonRoutablePrompt(preview: string): boolean {
  const trimmed = preview.trim().toLowerCase()
  if (!trimmed) return true

  // Slash commands use the command router, not keyword routing
  if (trimmed.startsWith('/')) return true

  // Very short prompts (≤3 words) are almost always conversational
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  if (wordCount <= 3) return true

  // Exact-match or starts-with conversational phrases
  const startsWithPhrases = [
    'please resume', 'keep as is', 'sounds good', 'looks good',
    'go ahead', 'i commit to', 'lets keep as is',
    'i will close this session', 'i dont believe we need',
    'can we get 1 prompt', 'how can i resume',
    // Meta-instructions (not work tasks)
    'quick fix', 'fyi ', 'btw ', 'note ',
  ]
  if (startsWithPhrases.some(p => trimmed.startsWith(p))) return true

  // Vague/generic requests that aren't specific enough to route
  const vaguePhrases = [
    'can we get more info',
    'can you get more info',
    'before we close this session',
  ]
  if (vaguePhrases.some(p => trimmed.startsWith(p))) return true

  // XML/system tags (task notifications, tool outputs) aren't user prompts
  if (trimmed.startsWith('<')) return true

  return false
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
    e.action !== 'opus_escalation' && !isNonRoutablePrompt(e.promptPreview ?? '')
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
