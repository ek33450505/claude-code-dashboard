import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLiveEvents } from '../api/useLive'
import { useAgents } from '../api/useAgents'
import type { AgentDefinition, LiveEvent, RoutingEvent } from '../types'
import { AGENT_PERSONALITIES } from '../utils/agentPersonalities'

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
  action: RoutingEvent['action'] | 'user_message' | 'assistant_message' | 'agent_spawned'
  agentName: string | null
  promptPreview: string
}

interface BeamState {
  agentName: string
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  phase: 'drawing' | 'active' | 'fading'
}

interface NodePosition {
  x: number
  y: number
  agent: AgentDefinition
}

// ------------------------------------------------------------------
// Model tier config
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

function isHaikuAgent(model: string): boolean {
  return model.toLowerCase().includes('haiku')
}

// ------------------------------------------------------------------
// Routing action badge config
// ------------------------------------------------------------------

const ACTION_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  dispatched:           { label: 'DISPATCHED',  color: '#00FFC2', bg: 'rgba(0,255,194,0.10)' },
  agent_dispatch:       { label: 'DISPATCHED',  color: '#00FFC2', bg: 'rgba(0,255,194,0.10)' },
  agent_complete:       { label: 'COMPLETE',    color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
  suggested:            { label: 'SUGGESTED',   color: '#fbbf24', bg: 'rgba(251,191,36,0.10)' },
  opus_escalation:      { label: 'OPUS',        color: '#c084fc', bg: 'rgba(192,132,252,0.10)' },
  no_match:             { label: 'NO MATCH',    color: '#5a6c8a', bg: 'rgba(90,108,138,0.08)' },
  skipped:              { label: 'SKIPPED',     color: '#5a6c8a', bg: 'rgba(90,108,138,0.08)' },
  senior_dev_dispatch:  { label: 'SENIOR DEV',  color: '#f472b6', bg: 'rgba(244,114,182,0.10)' },
  user_message:         { label: 'YOU',         color: '#94a3b8', bg: 'rgba(148,163,184,0.07)' },
  assistant_message:    { label: 'CLAUDE',      color: '#00FFC2', bg: 'rgba(0,255,194,0.07)' },
  agent_spawned:        { label: 'SPAWNED',     color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
}

function resolveActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { label: action.toUpperCase(), color: '#5a6c8a', bg: 'rgba(90,108,138,0.10)' }
}

// ------------------------------------------------------------------
// Radial position helpers
// ------------------------------------------------------------------

function buildNodePositions(
  agents: AgentDefinition[],
  cx: number,
  cy: number,
  innerRx: number,
  innerRy: number,
  outerRx: number,
  outerRy: number,
): NodePosition[] {
  const inner = agents.filter(a => isHaikuAgent(a.model))
  const outer = agents.filter(a => !isHaikuAgent(a.model))

  const positions: NodePosition[] = []

  // Stagger inner ring by half-step so nodes don't radially align with outer ring
  inner.forEach((agent, i) => {
    const angle = (i / inner.length) * 2 * Math.PI - Math.PI / 2 + Math.PI / inner.length
    positions.push({
      x: cx + innerRx * Math.cos(angle),
      y: cy + innerRy * Math.sin(angle),
      agent,
    })
  })

  outer.forEach((agent, i) => {
    const angle = (i / outer.length) * 2 * Math.PI - Math.PI / 2
    positions.push({
      x: cx + outerRx * Math.cos(angle),
      y: cy + outerRy * Math.sin(angle),
      agent,
    })
  })

  return positions
}

// ------------------------------------------------------------------
// ConstellationPanel — SVG radial layout
// ------------------------------------------------------------------

function ConstellationPanel({
  agents,
  activations,
  beams,
  elapsed,
}: {
  agents: AgentDefinition[]
  activations: Record<string, AgentActivation>
  beams: BeamState[]
  elapsed: Record<string, number>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 400, height: 500 })
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const cx = dims.width / 2
  const cy = dims.height / 2
  // Elliptical orbits fill the panel regardless of aspect ratio
  const padX = 90   // horizontal clearance for labels
  const padY = 60   // vertical clearance for labels
  const innerRx = (cx - padX) * 0.46
  const innerRy = (cy - padY) * 0.42
  const outerRx = (cx - padX) * 0.90
  const outerRy = (cy - padY) * 0.88

  const nodePositions = useMemo(
    () => buildNodePositions(agents, cx, cy, innerRx, innerRy, outerRx, outerRy),
    [agents, cx, cy, innerRx, innerRy, outerRx, outerRy],
  )

  const centerNodeR = 28
  const agentNodeR = 16

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
    >
      <svg
        width={dims.width}
        height={dims.height}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>
          {/* Glow filter for active nodes */}
          <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-center" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Radial gradient for orbit rings */}
          <radialGradient id="ring-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Orbit ring guides — ellipses matching node orbits */}
        {agents.some(a => isHaikuAgent(a.model)) && (
          <ellipse
            cx={cx}
            cy={cy}
            rx={innerRx}
            ry={innerRy}
            fill="none"
            stroke="rgba(96,165,250,0.07)"
            strokeWidth={1}
            strokeDasharray="4 8"
          />
        )}
        {agents.some(a => !isHaikuAgent(a.model)) && (
          <ellipse
            cx={cx}
            cy={cy}
            rx={outerRx}
            ry={outerRy}
            fill="none"
            stroke="rgba(129,140,248,0.07)"
            strokeWidth={1}
            strokeDasharray="4 8"
          />
        )}

        {/* Energy beams — layered glow + core + traveling particle */}
        {beams.map((beam, idx) => {
          const len = Math.sqrt(
            Math.pow(beam.x2 - beam.x1, 2) + Math.pow(beam.y2 - beam.y1, 2),
          )
          const opacity = beam.phase === 'fading' ? 0 : 1
          const drawOffset = beam.phase === 'drawing' ? len : 0
          const motionPath = `M${beam.x1},${beam.y1} L${beam.x2},${beam.y2}`
          // Travel duration scales with distance so speed is consistent
          const travelDur = `${(len / 220).toFixed(2)}s`

          return (
            <g key={`${beam.agentName}-${idx}`} style={{ transition: 'opacity 0.35s ease', opacity }}>
              {/* Soft glow halo */}
              <line
                x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2}
                stroke={beam.color}
                strokeWidth={8}
                strokeOpacity={0.12}
                strokeLinecap="round"
                filter="url(#glow-cyan)"
                strokeDasharray={len}
                strokeDashoffset={drawOffset}
                style={{ transition: beam.phase === 'drawing' ? 'stroke-dashoffset 0.4s ease-out' : undefined }}
              />
              {/* Core beam line */}
              <line
                x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2}
                stroke={beam.color}
                strokeWidth={1.5}
                strokeOpacity={0.9}
                strokeLinecap="round"
                strokeDasharray={len}
                strokeDashoffset={drawOffset}
                style={{ transition: beam.phase === 'drawing' ? 'stroke-dashoffset 0.4s ease-out' : undefined }}
              />
              {/* Traveling energy particle */}
              {beam.phase === 'active' && (
                <circle r={3} fill={beam.color} fillOpacity={0.95} filter="url(#glow-cyan)">
                  <animateMotion
                    dur={travelDur}
                    repeatCount="indefinite"
                    path={motionPath}
                  />
                </circle>
              )}
            </g>
          )
        })}

        {/* Center node — CLAUDE */}
        <g filter="url(#glow-center)">
          {/* Outer pulse ring */}
          <circle
            cx={cx}
            cy={cy}
            r={centerNodeR + 14}
            fill="none"
            stroke="rgba(0,255,194,0.15)"
            strokeWidth={1}
            style={{ animation: 'center-pulse 3s ease-in-out infinite' }}
          />
          {/* Background */}
          <circle
            cx={cx}
            cy={cy}
            r={centerNodeR}
            fill="rgba(0,20,30,0.9)"
            stroke="#00FFC2"
            strokeWidth={1.5}
          />
          {/* Inner glow fill */}
          <circle
            cx={cx}
            cy={cy}
            r={centerNodeR - 4}
            fill="rgba(0,255,194,0.06)"
          />
        </g>

        {/* CLAUDE label inside center */}
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#00FFC2"
          fontSize={9}
          fontWeight={800}
          fontFamily="'Courier New', monospace"
          letterSpacing="0.12em"
          style={{ userSelect: 'none' }}
        >
          CLAUDE
        </text>

        {/* Agent nodes */}
        {nodePositions.map(({ x, y, agent }) => {
          const activation = activations[agent.name] ?? { active: false, promptPreview: '' }
          const personality = AGENT_PERSONALITIES[agent.name]
          const agentColor = personality?.accentColor || agent.color || (isHaikuAgent(agent.model) ? '#60a5fa' : '#818cf8')
          const badge = resolveModelBadge(agent.model)
          const isHovered = hoveredAgent === agent.name
          const showCard = isHovered || activation.active
          const nodeR = activation.active ? agentNodeR * 1.45 : isHovered ? agentNodeR * 1.2 : agentNodeR
          const agentElapsed = elapsed[agent.name]

          // Tooltip card — only show on hover (active state shows prompt in label area)
          const cardW = 168
          const cardH = activation.active && activation.promptPreview ? 88 : 62
          const isRightSide = x > cx
          const rawCardX = isRightSide ? x + nodeR + 10 : x - nodeR - 10 - cardW
          const rawCardY = y - cardH / 2
          const cardX = Math.max(4, Math.min(dims.width - cardW - 4, rawCardX))
          const cardY = Math.max(4, Math.min(dims.height - cardH - 4, rawCardY))

          return (
            <g
              key={agent.name}
              onMouseEnter={() => setHoveredAgent(agent.name)}
              onMouseLeave={() => setHoveredAgent(null)}
              style={{ cursor: 'default' }}
            >
              {/* Pulse ring when active */}
              {activation.active && (
                <circle
                  cx={x}
                  cy={y}
                  r={nodeR + 12}
                  fill="none"
                  stroke={agentColor}
                  strokeWidth={1}
                  style={{
                    animation: 'node-pulse 1.5s ease-in-out infinite',
                    transformOrigin: `${x}px ${y}px`,
                  }}
                />
              )}

              {/* Spinning dashed orbit ring when active */}
              {activation.active && (
                <circle
                  cx={x}
                  cy={y}
                  r={nodeR + 20}
                  fill="none"
                  stroke={agentColor}
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  strokeDasharray="5 8"
                  style={{
                    animation: 'orbit-spin 3s linear infinite',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                />
              )}

              {/* Hover ring */}
              {isHovered && !activation.active && (
                <circle
                  cx={x}
                  cy={y}
                  r={nodeR + 6}
                  fill="none"
                  stroke={agentColor}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              )}

              {/* Node circle */}
              <circle
                cx={x}
                cy={y}
                r={nodeR}
                fill={
                  activation.active
                    ? `${agentColor}44`
                    : isHovered
                      ? `${agentColor}28`
                      : `${agentColor}14`
                }
                stroke={agentColor}
                strokeWidth={activation.active ? 2.5 : isHovered ? 2 : 1.5}
                strokeOpacity={activation.active ? 1 : isHovered ? 0.95 : 0.7}
                filter={activation.active ? 'url(#glow-cyan)' : isHovered ? 'url(#glow-cyan)' : undefined}
                style={{ transition: 'r 0.2s ease, fill 0.2s ease, stroke-width 0.2s ease, stroke-opacity 0.2s ease' }}
              />

              {/* Monogram inside node */}
              <text
                x={x}
                y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={activation.active ? agentColor : isHovered ? agentColor : `${agentColor}cc`}
                fontSize={activation.active ? 8 : 7}
                fontWeight={700}
                fontFamily="'Courier New', monospace"
                letterSpacing="0.05em"
                style={{ userSelect: 'none', transition: 'fill 0.2s ease, font-size 0.2s ease', pointerEvents: 'none' }}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </text>

              {/* Agent name — always visible below node */}
              <text
                x={x}
                y={y + nodeR + 13}
                textAnchor="middle"
                fill={activation.active ? '#e2e8f0' : isHovered ? '#e2e8f0' : `${agentColor}bb`}
                fontSize={activation.active ? 9 : isHovered ? 9 : 8}
                fontWeight={activation.active ? 700 : 500}
                fontFamily="'Courier New', monospace"
                letterSpacing="0.04em"
                style={{ userSelect: 'none', transition: 'fill 0.2s ease', pointerEvents: 'none' }}
              >
                {agent.name}
              </text>

              {/* Hover / active detail card via foreignObject */}
              {showCard && (
                <foreignObject x={cardX} y={cardY} width={cardW} height={cardH + 10}>
                  <div
                    style={{
                      background: 'rgba(8,14,24,0.96)',
                      border: `1px solid ${agentColor}66`,
                      borderLeft: `2px solid ${agentColor}`,
                      borderRadius: 6,
                      padding: '7px 10px',
                      fontFamily: "'Courier New', monospace",
                      pointerEvents: 'none',
                      boxShadow: `0 0 14px ${agentColor}22`,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 2, letterSpacing: '0.03em' }}>
                      {agent.name}
                    </div>
                    {personality && (
                      <div style={{ fontSize: 9, fontWeight: 700, color: agentColor, letterSpacing: '0.08em', marginBottom: 2 }}>
                        {personality.roleTitle}
                      </div>
                    )}
                    <div style={{ fontSize: 8, color: 'rgba(150,180,220,0.6)', marginBottom: activation.active && activation.promptPreview ? 4 : 0, fontStyle: personality?.tagline ? 'italic' : 'normal' }}>
                      {personality?.tagline ?? `${badge.label} · ${isHaikuAgent(agent.model) ? 'inner ring' : 'outer ring'}`}
                    </div>
                    {activation.active && activation.promptPreview && (
                      <div style={{ fontSize: 9, color: 'rgba(180,220,255,0.75)', marginTop: 4, lineHeight: 1.4, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4 }}>
                        "{activation.promptPreview.length > 38
                          ? `${activation.promptPreview.slice(0, 38)}…`
                          : activation.promptPreview}"
                      </div>
                    )}
                    {activation.active && agentElapsed !== undefined && (
                      <div style={{ fontSize: 8, color: `${agentColor}99`, marginTop: 3, fontFamily: "'Courier New', monospace", letterSpacing: '0.06em' }}>
                        ⏱ {agentElapsed}s running
                      </div>
                    )}
                  </div>
                </foreignObject>
              )}
            </g>
          )
        })}
      </svg>

      {/* CSS keyframes injected via style tag */}
      <style>{`
        @keyframes center-pulse {
          0%, 100% { opacity: 0.15; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.12); }
        }
        @keyframes node-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.1; }
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ------------------------------------------------------------------
// TerminalFeedEntry
// ------------------------------------------------------------------

function TerminalFeedEntry({ item, isFirst }: { item: RoutingFeedItem; isFirst: boolean }) {
  const style = resolveActionStyle(item.action)

  // Format timestamp as HH:MM:SS
  const ts = (() => {
    try {
      const d = new Date(item.timestamp)
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return item.timestamp.slice(11, 19) || '--:--:--'
    }
  })()

  return (
    <motion.div
      initial={isFirst ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontFamily: "'Courier New', monospace",
        position: 'relative',
      }}
    >
      {/* Timestamp line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: 'rgba(0,255,194,0.5)', fontSize: 10, fontWeight: 600 }}>{'>'}</span>
        <span style={{ color: 'rgba(150,180,200,0.5)', fontSize: 10 }}>{ts}</span>
      </div>

      {/* Action badge + agent name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: style.color,
            background: style.bg,
            border: `1px solid ${style.color}33`,
            borderRadius: 3,
            padding: '1px 6px',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}
        >
          {style.label}
        </span>
        {item.agentName && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(220,235,255,0.9)',
              letterSpacing: '0.02em',
            }}
          >
            {item.agentName}
          </span>
        )}
      </div>

      {/* Prompt preview */}
      {item.promptPreview && (
        <div
          style={{
            fontSize: 11,
            color: 'rgba(140,165,190,0.75)',
            marginLeft: 14,
            borderLeft: `2px solid ${style.color}33`,
            paddingLeft: 8,
            lineHeight: 1.5,
          }}
        >
          &quot;
          {item.promptPreview.length > 90
            ? `${item.promptPreview.slice(0, 90)}…`
            : item.promptPreview}
          &quot;
        </div>
      )}
    </motion.div>
  )
}

// ------------------------------------------------------------------
// LiveView — main export
// ------------------------------------------------------------------

export default function LiveView() {
  const { data: agents = [] } = useAgents()
  const [activations, setActivations] = useState<Record<string, AgentActivation>>({})
  const [activeAt, setActiveAt] = useState<Record<string, number>>({})
  const [elapsed, setElapsed] = useState<Record<string, number>>({})
  const [feed, setFeed] = useState<RoutingFeedItem[]>([])
  const [beams, setBeams] = useState<BeamState[]>([])
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const beamTimerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [svgDims, setSvgDims] = useState({ width: 400, height: 500 })

  // Tick elapsed seconds for active agents
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => {
        const now = Date.now()
        const next: Record<string, number> = {}
        for (const [name, startMs] of Object.entries(activeAt)) {
          next[name] = Math.floor((now - startMs) / 1000)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activeAt])

  // Track SVG container size for beam coordinate calculation
  useEffect(() => {
    if (!svgContainerRef.current) return
    const obs = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setSvgDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    obs.observe(svgContainerRef.current)
    return () => obs.disconnect()
  }, [])

  // Build node positions to find beam targets
  const nodePositions = useMemo(() => {
    const cx = svgDims.width / 2
    const cy = svgDims.height / 2
    const padX = 90
    const padY = 60
    const innerRx = (cx - padX) * 0.46
    const innerRy = (cy - padY) * 0.42
    const outerRx = (cx - padX) * 0.90
    const outerRy = (cy - padY) * 0.88
    return buildNodePositions(agents, cx, cy, innerRx, innerRy, outerRx, outerRy)
  }, [agents, svgDims])

  const handleEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'heartbeat') return

      // Stream live conversation messages from active session JSONL
      if (event.type === 'session_updated' && event.lastEntry?.message) {
        const entry = event.lastEntry
        const role = entry.message?.role
        const content = entry.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content.slice(0, 150)
        } else if (Array.isArray(content)) {
          const textBlock = (content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')
          text = textBlock?.text?.slice(0, 150) ?? ''
        }
        if (text.trim() && role) {
          setFeed(prev =>
            [
              {
                id: `msg-${event.timestamp}-${Math.random()}`,
                timestamp: event.timestamp,
                action: (role === 'user' ? 'user_message' : 'assistant_message') as RoutingFeedItem['action'],
                agentName: role === 'user' ? 'you' : 'claude',
                promptPreview: text.trim(),
              },
              ...prev,
            ].slice(0, 60),
          )
        }
        return
      }

      // Agent spawned (subagent JSONL appeared)
      if (event.type === 'agent_spawned') {
        const agentLabel = event.agentType ?? 'agent'
        setFeed(prev =>
          [
            {
              id: `spawn-${event.timestamp}-${Math.random()}`,
              timestamp: event.timestamp,
              action: 'agent_spawned' as RoutingFeedItem['action'],
              agentName: agentLabel,
              promptPreview: event.agentDescription ?? '',
            },
            ...prev,
          ].slice(0, 60),
        )
        return
      }

      if (event.type === 'routing_event' && event.event) {
        const re = event.event

        // Append to feed (newest first, cap at 40)
        setFeed(prev =>
          [
            {
              id: `${event.timestamp}-${Math.random()}`,
              timestamp: event.timestamp,
              action: re.action,
              agentName: re.matchedRoute ?? re.agentName ?? null,
              promptPreview: re.promptPreview ?? '',
            },
            ...prev,
          ].slice(0, 40),
        )

        const isDispatch =
          re.action === 'dispatched' ||
          re.action === 'agent_dispatch' ||
          re.action === 'senior_dev_dispatch'
        const isComplete = re.action === 'agent_complete'
        const targetName = re.matchedRoute ?? re.agentName ?? null

        if (isComplete && targetName) {
          // Deactivate on completion signal
          if (timerRefs.current[targetName]) {
            clearTimeout(timerRefs.current[targetName])
          }
          setActivations(prev => ({ ...prev, [targetName]: { active: false, promptPreview: '' } }))
          setActiveAt(prev => { const n = { ...prev }; delete n[targetName]; return n })
          // Fade and remove the energy beam
          setBeams(prev =>
            prev.map(b => b.agentName === targetName ? { ...b, phase: 'fading' as const } : b),
          )
          setTimeout(() => {
            setBeams(prev => prev.filter(b => b.agentName !== targetName))
          }, 400)
        }

        if (isDispatch && targetName && !event.historical) {
          // Activate agent — stay active until agent_complete fires
          setActivations(prev => ({
            ...prev,
            [targetName]: { active: true, promptPreview: re.promptPreview ?? '' },
          }))
          setActiveAt(prev => ({ ...prev, [targetName]: Date.now() }))

          // Fallback: auto-clear after 90s if no completion signal
          if (timerRefs.current[targetName]) {
            clearTimeout(timerRefs.current[targetName])
          }
          timerRefs.current[targetName] = setTimeout(() => {
            setActivations(prev => ({ ...prev, [targetName]: { active: false, promptPreview: '' } }))
            setActiveAt(prev => { const n = { ...prev }; delete n[targetName]; return n })
          }, 90000)

          // Fire SVG beam
          const targetNode = nodePositions.find(n => n.agent.name === targetName)
          if (targetNode) {
            const cx = svgDims.width / 2
            const cy = svgDims.height / 2
            const agentColor =
              targetNode.agent.color ||
              (isHaikuAgent(targetNode.agent.model) ? '#60a5fa' : '#818cf8')

            const newBeam: BeamState = {
              agentName: targetName,
              x1: cx,
              y1: cy,
              x2: targetNode.x,
              y2: targetNode.y,
              color: agentColor,
              phase: 'drawing',
            }

            setBeams(prev => [...prev.filter(b => b.agentName !== targetName), newBeam])

            // After draw animation, switch to fading phase
            if (beamTimerRefs.current[targetName]) {
              clearTimeout(beamTimerRefs.current[targetName])
            }

            // After draw completes, sustain as active energy line
            beamTimerRefs.current[targetName] = setTimeout(() => {
              setBeams(prev =>
                prev.map(b =>
                  b.agentName === targetName ? { ...b, phase: 'active' as const } : b,
                ),
              )
            }, 450)
          }
        }
      }
    },
    [nodePositions, svgDims],
  )

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
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '0.06em',
              fontFamily: "'Courier New', monospace",
              color: '#00FFC2',
              textTransform: 'uppercase',
            }}
          >
            Mission Control
          </h1>
          <AnimatePresence>
            {activeCount > 0 && (
              <motion.span
                key={activeCount}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#00FFC2',
                  background: 'rgba(0,255,194,0.12)',
                  border: '1px solid rgba(0,255,194,0.3)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: '0.04em',
                }}
              >
                {activeCount} ACTIVE
              </motion.span>
            )}
          </AnimatePresence>
          <span
            style={{
              fontSize: 10,
              color: 'rgba(150,175,200,0.5)',
              fontFamily: "'Courier New', monospace",
            }}
          >
            {agents.length} agents loaded
          </span>
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
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: "'Courier New', monospace",
              letterSpacing: '0.04em',
            }}
          >
            {connected ? 'STREAMING' : 'DISCONNECTED'}
          </span>
        </div>
      </header>

      {/* ── Split Panel ────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* ── Left: Constellation ───────────────────────────── */}
        <div
          ref={svgContainerRef}
          style={{
            flex: '0 0 60%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden',
            position: 'relative',
            background: 'rgba(0,5,15,0.4)',
          }}
        >
          {/* Constellation panel label */}
          <div
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'rgba(0,255,194,0.4)',
                fontFamily: "'Courier New', monospace",
                textTransform: 'uppercase',
              }}
            >
              Constellation
            </span>
            <span
              style={{
                fontSize: 9,
                color: 'rgba(96,165,250,0.4)',
                fontFamily: "'Courier New', monospace",
              }}
            >
              haiku · sonnet
            </span>
          </div>

          {/* SVG constellation */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {agents.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(150,175,200,0.4)',
                  fontSize: 11,
                  fontFamily: "'Courier New', monospace",
                }}
              >
                Loading agents…
              </div>
            ) : (
              <ConstellationPanel
                agents={agents}
                activations={activations}
                beams={beams}
                elapsed={elapsed}
              />
            )}
          </div>
        </div>

        {/* ── Right: Terminal Feed ──────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            background: 'rgba(0,0,0,0.4)',
            position: 'relative',
          }}
        >
          {/* Subtle scan-line overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
              zIndex: 1,
            }}
          />

          {/* Terminal feed header */}
          <div
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 2,
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'rgba(0,255,194,0.4)',
                fontFamily: "'Courier New', monospace",
                textTransform: 'uppercase',
              }}
            >
              Terminal Feed
              {feed.length > 0 && (
                <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.6 }}>
                  ({feed.length})
                </span>
              )}
            </span>
            {feed.length > 0 && (
              <button
                onClick={() => setFeed([])}
                style={{
                  fontSize: 9,
                  color: 'rgba(150,175,200,0.4)',
                  background: 'none',
                  border: '1px solid rgba(150,175,200,0.15)',
                  cursor: 'pointer',
                  padding: '1px 7px',
                  borderRadius: 3,
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: '0.04em',
                }}
              >
                CLR
              </button>
            )}
          </div>

          {/* Recent dispatches history strip */}
          {feed.filter(f => f.action === 'dispatched' || f.action === 'agent_dispatch').length > 0 && (
            <div style={{ flexShrink: 0, padding: '6px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(0,255,194,0.3)', fontFamily: "'Courier New', monospace", marginBottom: 5, textTransform: 'uppercase' }}>
                Recent dispatches
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {feed
                  .filter(f => f.action === 'dispatched' || f.action === 'agent_dispatch')
                  .slice(0, 10)
                  .map(f => {
                    const p = AGENT_PERSONALITIES[f.agentName ?? '']
                    const color = p?.accentColor ?? '#00FFC2'
                    return (
                      <span
                        key={f.id}
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color,
                          background: `${color}18`,
                          border: `1px solid ${color}44`,
                          borderRadius: 4,
                          padding: '2px 7px',
                          fontFamily: "'Courier New', monospace",
                          letterSpacing: '0.03em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.agentName}
                      </span>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Feed entries */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              position: 'relative',
              zIndex: 2,
            }}
          >
            {feed.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  gap: 8,
                  color: 'rgba(150,175,200,0.3)',
                  fontFamily: "'Courier New', monospace",
                }}
              >
                <span style={{ fontSize: 20 }}>_</span>
                <span style={{ fontSize: 11 }}>Waiting for routing events…</span>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {feed.map((item, idx) => (
                  <TerminalFeedEntry key={item.id} item={item} isFirst={idx === 0} />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Blinking cursor at bottom */}
          {connected && (
            <div
              style={{
                flexShrink: 0,
                padding: '6px 16px',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                zIndex: 2,
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                style={{
                  fontSize: 14,
                  color: '#00FFC2',
                  fontFamily: "'Courier New', monospace",
                  lineHeight: 1,
                }}
              >
                █
              </motion.span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
