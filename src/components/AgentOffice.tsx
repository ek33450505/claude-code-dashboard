/**
 * AgentOffice — persistent 8-bit office scene where all 28 agents live.
 *
 * Agent states:
 *   ACTIVE   — currently dispatched and running (glowing workstation, bouncing sprite)
 *   STANDBY  — in the office at their desk, idle (dim glow, subtle animation)
 *   OFFLINE  — not seen recently (very dim, static)
 */

import { useMemo } from 'react'
import { PixelSprite } from './PixelSprite'
import { getAgentSprite, AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import { useLiveAgents } from '../api/useLiveAgents'
import { AGENT_CATEGORIES } from '../utils/agentCategories'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

// ─── All 28 agents in department order ────────────────────────────────────

const DEPARTMENTS: Array<{ name: string; agents: readonly string[] }> = [
  { name: 'CORE', agents: AGENT_CATEGORIES.Core },
  { name: 'EXTENDED', agents: AGENT_CATEGORIES.Extended },
  { name: 'PRODUCTIVITY', agents: AGENT_CATEGORIES.Productivity },
  { name: 'PROFESSIONAL', agents: AGENT_CATEGORIES.Professional },
  { name: 'ORCHESTRATION', agents: AGENT_CATEGORIES.Orchestration },
]

type AgentStatus = 'active' | 'standby' | 'offline'

interface DeskProps {
  agentKey: string
  status: AgentStatus
  taskDesc?: string
}

// ─── Pixel desk decoration ─────────────────────────────────────────────────

function PixelDesk({ color }: { color: string }) {
  return (
    <div style={{ position: 'relative', width: 32, height: 10 }}>
      {/* Desk surface */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: `${color}30`,
        border: `1px solid ${color}50`,
        borderRadius: 1,
      }} />
      {/* Monitor */}
      <div style={{
        position: 'absolute', bottom: 4, left: 8, width: 10, height: 8,
        background: `${color}20`,
        border: `1px solid ${color}60`,
        borderRadius: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 6, height: 4, background: `${color}40` }} />
      </div>
      {/* Monitor stand */}
      <div style={{
        position: 'absolute', bottom: 3, left: 11, width: 4, height: 2,
        background: `${color}30`,
      }} />
    </div>
  )
}

// ─── Single agent workstation ──────────────────────────────────────────────

function AgentDesk({ agentKey, status, taskDesc }: DeskProps) {
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const sprite = getAgentSprite(agentKey)
  const color = personality.accentColor

  const glowIntensity = status === 'active' ? '0.6' : status === 'standby' ? '0.15' : '0'
  const spriteOpacity = status === 'offline' ? 0.25 : 1
  const borderOpacity = status === 'active' ? '50' : status === 'standby' ? '25' : '10'

  return (
    <div
      className="flex flex-col items-center gap-0.5 group cursor-default"
      title={`${agentKey}${taskDesc ? ` — ${taskDesc}` : ` (${status})`}`}
      style={{ minWidth: 44 }}
    >
      {/* Workstation card */}
      <div
        className="relative flex flex-col items-center p-1.5 rounded"
        style={{
          border: `1px solid ${color}${borderOpacity}`,
          background: status === 'active'
            ? `${color}12`
            : status === 'standby'
            ? 'rgba(255,255,255,0.02)'
            : 'transparent',
          boxShadow: status === 'active' ? `0 0 12px ${color}${glowIntensity === '0.6' ? '40' : '20'}` : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        {/* Active status ring */}
        {status === 'active' && (
          <div
            className="absolute -inset-0.5 rounded pointer-events-none"
            style={{
              border: `1px solid ${color}60`,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        )}

        {/* Sprite */}
        <div
          style={{
            opacity: spriteOpacity,
            animation: status === 'active'
              ? 'agent-idle 0.8s steps(2) infinite'
              : status === 'standby'
              ? 'agent-idle 3s steps(2) infinite'
              : 'none',
            filter: status === 'offline' ? 'grayscale(1)' : 'none',
            transition: 'opacity 0.4s, filter 0.4s',
          }}
        >
          <PixelSprite grid={sprite} scale={2} />
        </div>

        {/* Desk */}
        <PixelDesk color={color} />

        {/* Status dot */}
        <div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
          style={{
            backgroundColor: status === 'active' ? '#00FFC2'
              : status === 'standby' ? color
              : '#374151',
            boxShadow: status === 'active' ? `0 0 6px #00FFC2` : 'none',
            opacity: status === 'offline' ? 0.3 : 1,
          }}
        />
      </div>

      {/* Agent name */}
      <div
        className="truncate text-center"
        style={{
          ...PIXEL_FONT,
          fontSize: 4.5,
          color: status === 'active' ? color
            : status === 'standby' ? `${color}99`
            : '#374151',
          maxWidth: 44,
          lineHeight: 1.6,
          transition: 'color 0.4s',
        }}
        title={agentKey}
      >
        {agentKey.replace(/-/g, ' ')}
      </div>
    </div>
  )
}

// ─── Main office component ─────────────────────────────────────────────────

export default function AgentOffice() {
  const { data: liveAgents = [] } = useLiveAgents()

  // Build status map: agentKey → 'active' | 'standby' | 'offline'
  const statusMap = useMemo(() => {
    const map: Record<string, { status: AgentStatus; taskDesc?: string }> = {}

    // All agents default to standby
    for (const dept of DEPARTMENTS) {
      for (const agent of dept.agents) {
        map[agent] = { status: 'standby' }
      }
    }

    // Upgrade to active/idle based on live agents
    for (const la of liveAgents) {
      const key = la.agentType?.toLowerCase().replace(/\s+/g, '-') ?? ''
      if (!key || !map[key]) continue
      const inProgressTodo = la.todos?.find(t => t.status === 'in_progress')
      map[key] = {
        status: la.isActive ? 'active' : 'standby',
        taskDesc: la.isActive
          ? (inProgressTodo?.activeForm ?? la.description ?? la.taskPrompt?.slice(0, 60))
          : undefined,
      }
    }

    return map
  }, [liveAgents])

  const activeCount = Object.values(statusMap).filter(s => s.status === 'active').length

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 4px), #070A0F',
        border: '2px solid rgba(0,255,194,0.12)',
      }}
    >
      {/* Office header bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'rgba(0,255,194,0.05)',
          borderBottom: '1px solid rgba(0,255,194,0.1)',
        }}
      >
        <div style={{ ...PIXEL_FONT, fontSize: 8, color: '#00FFC2', lineHeight: 2 }}>
          CAST HQ
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00FFC2]" style={{ boxShadow: '0 0 6px #00FFC2' }} />
            <span style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#00FFC2' }}>{activeCount} ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#374151' }} />
            <span style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#6B7280' }}>{Object.keys(statusMap).length - activeCount} STANDBY</span>
          </div>
        </div>
      </div>

      {/* Office floor — departments as rows */}
      <div className="p-3 space-y-3 overflow-x-auto">
        {DEPARTMENTS.map(dept => (
          <div key={dept.name}>
            {/* Department label */}
            <div
              className="mb-2"
              style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#374151', letterSpacing: 1 }}
            >
              — {dept.name} —
            </div>
            {/* Agent desks row */}
            <div className="flex gap-2 flex-wrap">
              {dept.agents.map(agent => {
                const info = statusMap[agent] ?? { status: 'offline' as AgentStatus }
                return (
                  <AgentDesk
                    key={agent}
                    agentKey={agent}
                    status={info.status}
                    taskDesc={info.taskDesc}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes agent-idle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
