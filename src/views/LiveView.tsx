import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveEvents } from '../api/useLive'
import { useAgents } from '../api/useAgents'
import type { AgentDefinition, LiveEvent, RoutingEvent } from '../types'
import { timeAgo } from '../utils/time'

// ------------------------------------------------------------------
// Local types
// ------------------------------------------------------------------

interface AgentActivation {
  active: boolean
  promptPreview: string
}

interface RoutingFeedItem {
  id: string
  timestamp: string
  action: RoutingEvent['action']
  agentName: string | null
  promptPreview: string
}

// ------------------------------------------------------------------
// Model tier badge config
// ------------------------------------------------------------------

const MODEL_TIERS: Record<string, { label: string; color: string; bg: string }> = {
  haiku:  { label: 'haiku',  color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  sonnet: { label: 'sonnet', color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  opus:   { label: 'opus',   color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
}

function resolveModelBadge(model: string) {
  const key = Object.keys(MODEL_TIERS).find(k => model.toLowerCase().includes(k))
  return key ? MODEL_TIERS[key] : { label: model, color: '#5a6c8a', bg: 'rgba(90,108,138,0.12)' }
}

// ------------------------------------------------------------------
// Routing action badge config
// ------------------------------------------------------------------

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  dispatched:      { label: 'DISPATCHED', color: '#00FFC2', bg: 'rgba(0,255,194,0.10)' },
  agent_dispatch:  { label: 'DISPATCHED', color: '#00FFC2', bg: 'rgba(0,255,194,0.10)' },
  suggested:       { label: 'SUGGESTED',  color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  opus_escalation: { label: 'OPUS',       color: '#c084fc', bg: 'rgba(192,132,252,0.10)' },
  no_match:        { label: 'NO MATCH',   color: '#5a6c8a', bg: 'rgba(90,108,138,0.10)' },
  skipped:         { label: 'SKIPPED',    color: '#5a6c8a', bg: 'rgba(90,108,138,0.10)' },
}

function resolveActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { label: action.toUpperCase(), color: '#5a6c8a', bg: 'rgba(90,108,138,0.10)' }
}

// ------------------------------------------------------------------
// AgentCard
// ------------------------------------------------------------------

function AgentCard({
  agent,
  activation,
}: {
  agent: AgentDefinition
  activation: AgentActivation
}) {
  const color = agent.color || '#5a6c8a'
  const badge = resolveModelBadge(agent.model)

  return (
    <motion.div
      animate={
        activation.active
          ? {
              scale: 1.3,
              opacity: 1,
              boxShadow: `0 0 20px ${color}55, 0 0 8px ${color}33`,
            }
          : {
              scale: 1,
              opacity: 1,
              boxShadow: 'none',
            }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{
        flexShrink: 0,
        background: activation.active
          ? `linear-gradient(135deg, ${color}22, ${color}0a)`
          : `linear-gradient(135deg, ${badge.bg}, rgba(0,0,0,0.05))`,
        border: `1px solid ${activation.active ? `${color}66` : badge.color + '33'}`,
        borderBottom: `2px solid ${activation.active ? color : badge.color + '55'}`,
        borderRadius: 12,
        padding: '14px 10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        userSelect: 'none',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.3s ease, border-color 0.3s ease',
        cursor: 'default',
      }}
    >
      {/* Active pulse ring */}
      {activation.active && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 12,
            border: `1px solid ${color}`,
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Color dot with model-tier glow */}
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
          boxShadow: activation.active
            ? `0 0 14px ${color}, 0 0 6px ${color}88`
            : `0 0 6px ${color}88`,
          transition: 'box-shadow 0.3s ease',
        }}
      />

      {/* Name */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: activation.active ? 'var(--text-primary)' : 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.2,
          wordBreak: 'break-word',
          maxWidth: '100%',
          transition: 'color 0.25s ease',
        }}
      >
        {agent.name}
      </span>

      {/* Model badge */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: badge.color,
          background: badge.bg,
          borderRadius: 4,
          padding: '2px 7px',
          whiteSpace: 'nowrap',
          letterSpacing: '0.03em',
        }}
      >
        {badge.label}
      </span>

      {/* Prompt preview — visible only when active */}
      <AnimatePresence>
        {activation.active && activation.promptPreview && (
          <motion.p
            key="preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              margin: 0,
              fontSize: 10,
              color: 'var(--text-secondary)',
              textAlign: 'center',
              lineHeight: 1.4,
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflow: 'hidden',
            }}
          >
            {activation.promptPreview.length > 35
              ? `${activation.promptPreview.slice(0, 35)}…`
              : activation.promptPreview}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ------------------------------------------------------------------
// RoutingFeedRow
// ------------------------------------------------------------------

function RoutingFeedRow({ item }: { item: RoutingFeedItem }) {
  const style = resolveActionStyle(item.action)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Action badge */}
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: style.color,
          background: style.bg,
          borderRadius: 4,
          padding: '2px 7px',
          marginTop: 1,
        }}
      >
        {style.label}
      </span>

      {/* Agent + prompt */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.agentName && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginRight: 8,
            }}
          >
            {item.agentName}
          </span>
        )}
        {item.promptPreview && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}
          >
            {item.promptPreview.length > 80
              ? `${item.promptPreview.slice(0, 80)}…`
              : item.promptPreview}
          </span>
        )}
      </div>

      {/* Timestamp */}
      <span
        style={{
          flexShrink: 0,
          fontSize: 11,
          color: 'var(--text-muted)',
          marginTop: 2,
          whiteSpace: 'nowrap',
        }}
      >
        {timeAgo(item.timestamp)}
      </span>
    </div>
  )
}

// ------------------------------------------------------------------
// LiveView — main export
// ------------------------------------------------------------------

export default function LiveView() {
  // Only show LOCAL agents from ~/.claude/agents/ (dynamic from API, not a hardcoded registry)
  const { data: agents = [] } = useAgents()
  const [activations, setActivations] = useState<Record<string, AgentActivation>>({})
  const [feed, setFeed] = useState<RoutingFeedItem[]>([])
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'heartbeat') return

    if (event.type === 'routing_event' && event.event) {
      const re = event.event

      // Append to feed (most recent first, cap at 20)
      setFeed(prev => [
        {
          id: `${event.timestamp}-${Math.random()}`,
          timestamp: event.timestamp,
          action: re.action,
          agentName: re.matchedRoute ?? re.agentName ?? null,
          promptPreview: re.promptPreview ?? '',
        },
        ...prev,
      ].slice(0, 20))

      // Activate the matched agent card
      const isDispatch =
        re.action === 'dispatched' ||
        re.action === 'agent_dispatch'
      const targetName = re.matchedRoute ?? re.agentName ?? null

      if (isDispatch && targetName) {
        setActivations(prev => ({
          ...prev,
          [targetName]: { active: true, promptPreview: re.promptPreview ?? '' },
        }))

        if (timerRefs.current[targetName]) {
          clearTimeout(timerRefs.current[targetName])
        }

        timerRefs.current[targetName] = setTimeout(() => {
          setActivations(prev => ({
            ...prev,
            [targetName]: { active: false, promptPreview: '' },
          }))
        }, 3500)
      }
    }
  }, [])

  const { connected } = useLiveEvents(handleEvent)

  const activeCount = Object.values(activations).filter(a => a.active).length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Activity</h1>
          {activeCount > 0 && (
            <motion.span
              key={activeCount}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#00FFC2',
                background: 'rgba(0,255,194,0.10)',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              {activeCount} active
            </motion.span>
          )}
        </div>

        {/* SSE connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
            {connected && (
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  opacity: 0.75,
                  animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: connected ? 'var(--success)' : 'var(--error)',
              }}
            />
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {connected ? 'Streaming' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* ── Agent Queue Row ──────────────────────────────────────── */}
      <section
        style={{
          flexShrink: 0,
          padding: '16px 20px 20px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
          }}
        >
          Agent Queue — {agents.length} local agents
        </p>

        {agents.length === 0 ? (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            Loading agents…
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 8,
            }}
          >
            {agents.map(agent => (
              <AgentCard
                key={agent.name}
                agent={agent}
                activation={activations[agent.name] ?? { active: false, promptPreview: '' }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Routing Events Feed ──────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Feed header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px 8px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            Routing Events
            {feed.length > 0 && (
              <span style={{ marginLeft: 8, fontWeight: 400 }}>({feed.length})</span>
            )}
          </p>
          {feed.length > 0 && (
            <button
              onClick={() => setFeed([])}
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Feed list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {feed.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontStyle: 'italic',
              }}
            >
              Waiting for routing events…
            </div>
          ) : (
            feed.map(item => <RoutingFeedRow key={item.id} item={item} />)
          )}
        </div>
      </section>
    </div>
  )
}
