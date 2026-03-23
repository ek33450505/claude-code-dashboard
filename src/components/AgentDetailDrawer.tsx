/**
 * AgentDetailDrawer — slide-in drawer showing agent details when clicked in the office.
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { AGENT_PERSONALITIES, getAgentSprite, getModelTier } from '../utils/agentPersonalities'
import { useLiveAgents } from '../api/useLiveAgents'
import { useRoutingStats } from '../api/useRouting'
import { PixelSprite } from './PixelSprite'

interface AgentDetailDrawerProps {
  agentKey: string | null
  onClose: () => void
}

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

export default function AgentDetailDrawer({ agentKey, onClose }: AgentDetailDrawerProps) {
  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { data: liveAgents = [] } = useLiveAgents()
  const { data: routingStats } = useRoutingStats()

  // Get personality data
  const personality = agentKey
    ? (AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose'])
    : null
  const sprite = agentKey ? getAgentSprite(agentKey) : null

  // Get current live task if agent is active
  const liveAgent = liveAgents.find(
    (a) => a.agentType === agentKey && a.isActive
  )

  // Get recent routing events for this agent (last 5, most recent first)
  const recentEvents = agentKey
    ? (routingStats?.recentEvents ?? [])
        .filter((e) => e.agentName === agentKey)
        .slice(-5)
        .reverse()
    : []

  const color = personality?.accentColor ?? '#00FFC2'
  const modelTier = getModelTier(liveAgent?.model)

  return (
    <AnimatePresence>
      {agentKey && personality && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(7,10,15,0.7)',
              zIndex: 40,
            }}
          />

          {/* Drawer panel */}
          <motion.div
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 280,
              background: '#0D1117',
              borderLeft: `2px solid ${color}40`,
              boxShadow: `-8px 0 32px ${color}18`,
              zIndex: 50,
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header: sprite + name + close */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                style={{
                  border: `1px solid ${color}40`,
                  background: `${color}0a`,
                  padding: 6,
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                <PixelSprite grid={sprite!} scale={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...PIXEL_FONT, fontSize: 8, color, marginBottom: 4 }}>
                  {personality.roleTitle}
                </div>
                <div
                  style={{
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 11,
                    color: '#88A3D6',
                  }}
                >
                  {agentKey}
                </div>
                <div
                  style={{
                    fontFamily: 'Geist, sans-serif',
                    fontSize: 10,
                    color: '#5a6c8a',
                    marginTop: 4,
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;{personality.tagline}&rdquo;
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#5a6c8a',
                  fontSize: 14,
                  padding: 4,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: `${color}20` }} />

            {/* Model tier + routing command */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  ...PIXEL_FONT,
                  fontSize: 6,
                  padding: '3px 8px',
                  borderRadius: 3,
                  background: modelTier.bg,
                  color: modelTier.color,
                  border: `1px solid ${modelTier.color}40`,
                }}
              >
                {modelTier.label}
              </span>
            </div>

            {/* Live task (if active) */}
            {liveAgent && (
              <div>
                <div
                  style={{ ...PIXEL_FONT, fontSize: 6, color: '#00FFC2', marginBottom: 8 }}
                >
                  &#9654; LIVE
                </div>
                <div
                  style={{
                    background: '#00FFC215',
                    border: '1px solid #00FFC230',
                    borderRadius: 4,
                    padding: 10,
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 10,
                    color: '#E6E8EE',
                    lineHeight: 1.5,
                  }}
                >
                  {liveAgent.description ?? liveAgent.taskPrompt ?? 'Working...'}
                </div>
              </div>
            )}

            {/* Recent routing events */}
            {recentEvents.length > 0 && (
              <div>
                <div
                  style={{
                    ...PIXEL_FONT,
                    fontSize: 6,
                    color: '#88A3D6',
                    marginBottom: 8,
                  }}
                >
                  RECENT
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentEvents.map((event, i) => (
                    <div
                      key={i}
                      style={{
                        fontFamily: 'Geist, sans-serif',
                        fontSize: 10,
                        color: '#5a6c8a',
                        padding: '6px 8px',
                        background: '#1A1D2320',
                        borderLeft: `2px solid ${color}30`,
                        borderRadius: '0 3px 3px 0',
                      }}
                    >
                      {event.promptPreview ?? event.action ?? 'task'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!liveAgent && recentEvents.length === 0 && (
              <div
                style={{
                  fontFamily: 'Geist, sans-serif',
                  fontSize: 10,
                  color: '#374151',
                  textAlign: 'center',
                  padding: 20,
                  fontStyle: 'italic',
                }}
              >
                No recent activity
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
