/**
 * DelegationChain — per-prompt mission cards showing which agents were dispatched
 * for each user prompt, with running / completed / ad-hoc status.
 *
 * Groups routing events into "prompt sessions":
 *   dispatched/suggested event → anchor the session with the user's prompt text
 *   agent_dispatch events within 30s → belong to that session
 */

import { motion } from 'framer-motion'
import { PixelSprite } from './PixelSprite'
import { getAgentSprite, getSeniorDevSprite, AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import { useRoutingStats } from '../api/useRouting'
import { useLiveAgents } from '../api/useLiveAgents'
import type { RoutingEvent, LiveAgent } from '../types'
import { timeAgo } from '../utils/time'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

// ─── Session grouping ──────────────────────────────────────────────────────

interface PromptSession {
  promptText: string
  action: string        // 'dispatched' | 'suggested' | 'no_match' | 'agent_dispatch'
  timestamp: string
  agents: RoutingEvent[]
}

/**
 * Merge prompt events and dispatch events into per-prompt sessions.
 * A dispatch event belongs to the nearest preceding prompt event within 30s,
 * or starts its own group if no prompt anchor exists.
 */
function buildSessions(events: RoutingEvent[]): PromptSession[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const sessions: PromptSession[] = []

  for (const event of sorted) {
    const isDispatch = event.action === 'agent_dispatch' || event.action === 'senior_dev_dispatch'
    const isPrompt = !isDispatch

    if (isPrompt) {
      // Start a new session anchored to this prompt
      sessions.push({
        promptText: event.promptPreview ?? '',
        action: event.action,
        timestamp: event.timestamp,
        agents: [],
      })
    } else {
      // Find the most recent session within 30s
      const eventTime = new Date(event.timestamp).getTime()
      let matched = false
      for (let i = sessions.length - 1; i >= 0; i--) {
        const sessionTime = new Date(sessions[i].timestamp).getTime()
        if (eventTime - sessionTime <= 30_000) {
          sessions[i].agents.push(event)
          matched = true
          break
        }
      }
      if (!matched) {
        // No prompt anchor — create an ad-hoc session for this dispatch
        sessions.push({
          promptText: event.promptPreview?.slice(0, 60) ?? 'ad-hoc dispatch',
          action: event.action,
          timestamp: event.timestamp,
          agents: [event],
        })
      }
    }
  }

  // Only sessions that have at least one agent dispatch, most recent first
  // Show 2 most recent — sidebar is live-focused, not historical
  return sessions.filter(s => s.agents.length > 0).reverse().slice(0, 2)
}

// ─── Agent chip ────────────────────────────────────────────────────────────

function AgentChip({
  event,
  liveAgent,
  delay,
}: {
  event: RoutingEvent
  liveAgent?: LiveAgent
  delay: number
}) {
  const agentKey = (event.agentName ?? event.matchedRoute ?? 'general-purpose')
    .toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const sprite = getAgentSprite(agentKey)

  const isRunning = !!liveAgent?.isActive
  const wasRunning = !!liveAgent && !liveAgent.isActive

  const statusColor = isRunning ? '#00FFC2' : wasRunning ? '#6B7280' : personality.accentColor
  const statusLabel = isRunning ? 'RUNNING' : wasRunning ? 'DONE' : ''

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-1"
    >
      {/* Sprite card */}
      <div
        className="p-1.5 rounded relative"
        style={{
          border: `2px solid ${statusColor}50`,
          background: `${statusColor}08`,
          boxShadow: isRunning ? `0 0 10px ${statusColor}40` : 'none',
          opacity: wasRunning ? 0.6 : 1,
        }}
      >
        {/* Running pulse ring */}
        {isRunning && (
          <div
            className="absolute -inset-1 rounded"
            style={{
              border: `1px solid ${statusColor}60`,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}
        <PixelSprite grid={sprite} scale={2} />
      </div>

      {/* Agent name */}
      <div
        className="text-center max-w-[52px] truncate"
        style={{ ...PIXEL_FONT, fontSize: 5, color: statusColor, lineHeight: 1.8 }}
        title={agentKey}
      >
        {agentKey.replace(/-/g, ' ')}
      </div>

      {/* Status badge */}
      {statusLabel && (
        <div
          className="px-1 rounded"
          style={{ ...PIXEL_FONT, fontSize: 4, color: statusColor, background: `${statusColor}15` }}
        >
          {statusLabel}
        </div>
      )}
    </motion.div>
  )
}

// ─── Session card ──────────────────────────────────────────────────────────

function SessionCard({ session, liveAgents, index }: {
  session: PromptSession
  liveAgents: LiveAgent[]
  index: number
}) {
  const runningCount = session.agents.filter(e => {
    const key = (e.agentName ?? e.matchedRoute ?? '').toLowerCase()
    return liveAgents.some(a => a.agentType?.toLowerCase() === key && a.isActive)
  }).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.25 }}
      className="rounded-xl p-3"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), var(--bg-secondary)',
        border: runningCount > 0
          ? '2px solid rgba(0,255,194,0.3)'
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: runningCount > 0 ? '0 0 12px rgba(0,255,194,0.1)' : 'none',
      }}
    >
      {/* Prompt label */}
      <div className="flex items-start gap-2 mb-3">
        {/* Senior Dev sprite */}
        <div className="shrink-0">
          <PixelSprite grid={getSeniorDevSprite()} scale={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ ...PIXEL_FONT, fontSize: 5, color: '#00FFC2' }}>SENIOR DEV</span>
            {runningCount > 0 && (
              <span
                className="px-1 rounded"
                style={{ ...PIXEL_FONT, fontSize: 4, color: '#00FFC2', background: 'rgba(0,255,194,0.12)' }}
              >
                {runningCount} ACTIVE
              </span>
            )}
            <span className="ml-auto text-[9px] text-[var(--text-muted)]">
              {timeAgo(session.timestamp)}
            </span>
          </div>
          <p
            className="text-[var(--text-muted)] leading-relaxed truncate"
            style={{ fontSize: 10 }}
            title={session.promptText}
          >
            "{session.promptText.slice(0, 80)}"
          </p>
        </div>
      </div>

      {/* Agent chips */}
      <div className="flex flex-wrap gap-2 pl-1">
        {session.agents.map((event, i) => {
          const key = (event.agentName ?? event.matchedRoute ?? '').toLowerCase()
          const liveAgent = liveAgents.find(a => a.agentType?.toLowerCase() === key)
          return (
            <AgentChip
              key={i}
              event={event}
              liveAgent={liveAgent}
              delay={index * 0.07 + i * 0.04}
            />
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function DelegationChain() {
  const { data: routingStats } = useRoutingStats()
  const { data: liveAgents = [] } = useLiveAgents()

  const allEvents = routingStats?.recentEvents ?? []
  if (allEvents.length === 0) return null

  const sessions = buildSessions(allEvents)
  if (sessions.length === 0) return null

  return (
    <div>
      <h2
        className="mb-3 uppercase tracking-wider text-[var(--text-muted)]"
        style={{ ...PIXEL_FONT, fontSize: 9 }}
      >
        Prompt Missions
        <span className="ml-3" style={{ color: '#00FFC2' }}>{sessions.length}</span>
      </h2>

      <div className="space-y-3">
        {sessions.map((session, i) => (
          <SessionCard
            key={i}
            session={session}
            liveAgents={liveAgents}
            index={i}
          />
        ))}
      </div>
    </div>
  )
}
