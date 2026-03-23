/**
 * AgentOffice — persistent 8-bit office scene where all 28 agents live.
 *
 * Agent states:
 *   ACTIVE   — walked to their cubicle to work (animated entrance, bouncing sprite, task shown)
 *   STANDBY  — at their department desk, idle (dim, slow bounce)
 *   OFFLINE  — not seen recently (very dim, static)
 *
 * When an agent goes active they "walk out" of the department row and appear
 * in the ACTIVE CUBICLES section at the top. Their desk shows AWAY.
 */

import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

// ─── Pixel desk decoration ─────────────────────────────────────────────────

function PixelDesk({ color, empty }: { color: string; empty?: boolean }) {
  return (
    <div style={{ position: 'relative', width: 32, height: 10 }}>
      {/* Desk surface */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: empty ? 'rgba(55,65,81,0.3)' : `${color}30`,
        border: `1px solid ${empty ? '#37415150' : `${color}50`}`,
        borderRadius: 1,
      }} />
      {/* Monitor */}
      <div style={{
        position: 'absolute', bottom: 4, left: 8, width: 10, height: 8,
        background: empty ? 'rgba(55,65,81,0.15)' : `${color}20`,
        border: `1px solid ${empty ? '#37415130' : `${color}60`}`,
        borderRadius: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 6, height: 4, background: empty ? '#37415120' : `${color}40` }} />
      </div>
      {/* Monitor stand */}
      <div style={{
        position: 'absolute', bottom: 3, left: 11, width: 4, height: 2,
        background: empty ? '#37415120' : `${color}30`,
      }} />
    </div>
  )
}

// ─── Empty "AWAY" desk slot ────────────────────────────────────────────────

function AwayDesk({ agentKey }: { agentKey: string }) {
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const color = personality.accentColor

  return (
    <div
      className="flex flex-col items-center gap-0.5"
      style={{ minWidth: 44, opacity: 0.35 }}
      title={`${agentKey} — working in cubicle`}
    >
      {/* Empty workstation */}
      <div
        className="relative flex flex-col items-center p-1.5 rounded"
        style={{
          border: `1px dashed ${color}25`,
          background: 'transparent',
        }}
      >
        {/* Empty chair placeholder */}
        <div style={{ width: 16, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...PIXEL_FONT, fontSize: 4, color: `${color}60`, letterSpacing: 0 }}>AWAY</div>
        </div>
        <PixelDesk color={color} empty />
      </div>
      {/* Agent name */}
      <div
        className="truncate text-center"
        style={{ ...PIXEL_FONT, fontSize: 4.5, color: `${color}40`, maxWidth: 44, lineHeight: 1.6 }}
      >
        {agentKey.replace(/-/g, ' ')}
      </div>
    </div>
  )
}

// ─── Standby desk slot ────────────────────────────────────────────────────

function AgentDesk({ agentKey, status }: { agentKey: string; status: AgentStatus }) {
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const sprite = getAgentSprite(agentKey)
  const color = personality.accentColor

  const spriteOpacity = status === 'offline' ? 0.2 : 1
  const borderOpacity = status === 'standby' ? '25' : '10'

  return (
    <div
      className="flex flex-col items-center gap-0.5 cursor-default"
      title={`${agentKey} (${status})`}
      style={{ minWidth: 44 }}
    >
      <div
        className="relative flex flex-col items-center p-1.5 rounded"
        style={{
          border: `1px solid ${color}${borderOpacity}`,
          background: 'rgba(255,255,255,0.02)',
          transition: 'all 0.4s ease',
        }}
      >
        {/* Status dot */}
        <div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
          style={{
            backgroundColor: status === 'standby' ? color : '#374151',
            opacity: status === 'offline' ? 0.2 : 0.7,
          }}
        />

        {/* Sprite */}
        <div style={{
          opacity: spriteOpacity,
          animation: status === 'standby' ? 'agent-idle 3s steps(2) infinite' : 'none',
          filter: status === 'offline' ? 'grayscale(1)' : 'none',
          transition: 'opacity 0.4s, filter 0.4s',
        }}>
          <PixelSprite grid={sprite} scale={2} />
        </div>

        <PixelDesk color={color} />
      </div>

      <div
        className="truncate text-center"
        style={{
          ...PIXEL_FONT, fontSize: 4.5, maxWidth: 44, lineHeight: 1.6,
          color: status === 'standby' ? `${color}80` : '#2d3748',
          transition: 'color 0.4s',
        }}
        title={agentKey}
      >
        {agentKey.replace(/-/g, ' ')}
      </div>
    </div>
  )
}

// ─── Active cubicle card ───────────────────────────────────────────────────

function CubicleCard({ agentKey, taskDesc }: { agentKey: string; taskDesc?: string }) {
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const sprite = getAgentSprite(agentKey)
  const color = personality.accentColor

  return (
    <motion.div
      layout
      layoutId={`cubicle-${agentKey}`}
      initial={{ opacity: 0, y: 12, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="flex flex-col items-center gap-1 shrink-0"
      title={`${agentKey}${taskDesc ? ` — ${taskDesc}` : ''}`}
      style={{ width: 60 }}
    >
      {/* Cubicle workstation */}
      <div
        className="relative flex flex-col items-center rounded p-2 w-full"
        style={{
          border: `2px solid ${color}50`,
          background: `${color}0a`,
          boxShadow: `0 0 14px ${color}30`,
        }}
      >
        {/* Pulse ring */}
        <div
          className="absolute -inset-0.5 rounded pointer-events-none"
          style={{ border: `1px solid ${color}40`, animation: 'pulse 2s ease-in-out infinite' }}
        />

        {/* Bouncing sprite */}
        <div style={{ animation: 'agent-idle 0.8s steps(2) infinite' }}>
          <PixelSprite grid={sprite} scale={3} />
        </div>

        {/* Larger pixel desk */}
        <div style={{ position: 'relative', width: 44, height: 13, marginTop: 2 }}>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 5,
            background: `${color}35`, border: `1px solid ${color}55`, borderRadius: 1,
          }} />
          <div style={{
            position: 'absolute', bottom: 5, left: 12, width: 14, height: 10,
            background: `${color}25`, border: `1px solid ${color}65`,
            borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 8, height: 5, background: `${color}50` }} />
          </div>
        </div>

        {/* Active dot */}
        <div
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#00FFC2]"
          style={{ boxShadow: '0 0 6px #00FFC2' }}
        />
      </div>

      {/* Name */}
      <div
        className="truncate text-center w-full"
        style={{ ...PIXEL_FONT, fontSize: 4, color, lineHeight: 1.8 }}
        title={agentKey}
      >
        {agentKey.replace(/-/g, ' ')}
      </div>

      {/* Task description ticker */}
      {taskDesc && (
        <div
          className="text-center truncate w-full"
          style={{ fontSize: 8, color: `${color}90`, lineHeight: 1.3 }}
          title={taskDesc}
        >
          {taskDesc.slice(0, 24)}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main office component ─────────────────────────────────────────────────

export default function AgentOffice() {
  const { data: liveAgents = [] } = useLiveAgents()

  const statusMap = useMemo(() => {
    const map: Record<string, { status: AgentStatus; taskDesc?: string }> = {}

    for (const dept of DEPARTMENTS) {
      for (const agent of dept.agents) {
        map[agent] = { status: 'standby' }
      }
    }

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

  const activeAgents = Object.entries(statusMap).filter(([, v]) => v.status === 'active')
  const activeCount = activeAgents.length
  const hasActivity = activeAgents.length > 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 4px), #070A0F',
        border: '2px solid rgba(0,255,194,0.12)',
      }}
    >
      {/* Office header */}
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
            <span style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#6B7280' }}>
              {Object.keys(statusMap).length - activeCount} STANDBY
            </span>
          </div>
        </div>
      </div>

      {/* ─── Active Cubicles ─── */}
      <AnimatePresence>
        {activeCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden', borderBottom: '1px solid rgba(0,255,194,0.15)' }}
          >
            <div
              className="px-3 pt-2 pb-3"
              style={{ background: 'rgba(0,255,194,0.03)' }}
            >
              <div
                className="mb-2"
                style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#00FFC2', letterSpacing: 1 }}
              >
                — ACTIVE CUBICLES —
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                <AnimatePresence mode="popLayout">
                  {activeAgents.map(([agentKey, info]) => (
                    <CubicleCard
                      key={agentKey}
                      agentKey={agentKey}
                      taskDesc={info.taskDesc}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Department standby floor ─── */}
      {hasActivity ? (
        <div className="p-3 space-y-3 overflow-x-auto">
          {DEPARTMENTS.map(dept => (
            <div key={dept.name}>
              <div
                className="mb-2"
                style={{ ...PIXEL_FONT, fontSize: 5.5, color: '#374151', letterSpacing: 1 }}
              >
                — {dept.name} —
              </div>
              <div className="flex gap-2 flex-wrap">
                {dept.agents.map(agent => {
                  const info = statusMap[agent] ?? { status: 'offline' as AgentStatus }
                  // Active agents show an empty "AWAY" desk
                  if (info.status === 'active') {
                    return <AwayDesk key={agent} agentKey={agent} />
                  }
                  return (
                    <AgentDesk
                      key={agent}
                      agentKey={agent}
                      status={info.status}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: 0.4,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          color: '#5a6c8a',
          letterSpacing: '0.1em',
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#374151',
          }} />
          ALL AGENTS STANDING BY
        </div>
      )}

      <style>{`
        @keyframes agent-idle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  )
}
