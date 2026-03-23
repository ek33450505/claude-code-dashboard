import { motion, AnimatePresence } from 'framer-motion'
import { PixelSprite } from './PixelSprite'
import { getAgentSprite, getAgentFrames, AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import { LOCAL_AGENTS } from '../utils/localAgents'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }
const SPRITE_SCALE = 4

interface AgentOfficeStripProps {
  liveAgentNames: string[]  // lowercased agent keys currently active
}

export default function AgentOfficeStrip({ liveAgentNames }: AgentOfficeStripProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--border)',
        background: '#0a0f16',
        minHeight: 0,
      }}
    >
      {/* Queue zone — sticky left */}
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 2,
          width: 56,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRight: '1px dashed rgba(0,255,194,0.18)',
          background: '#0a0f16',
          padding: '8px 4px',
          gap: 4,
        }}
      >
        <span style={{ ...PIXEL_FONT, fontSize: 5, color: 'rgba(0,255,194,0.5)', letterSpacing: 1 }}>QUEUE</span>
        <AnimatePresence>
          {liveAgentNames.length === 0 ? (
            <span style={{ ...PIXEL_FONT, fontSize: 5, color: 'rgba(90,108,138,0.5)' }}>...</span>
          ) : (
            liveAgentNames.map(name => {
              const personality = AGENT_PERSONALITIES[name] ?? AGENT_PERSONALITIES['general-purpose']
              return (
                <motion.div
                  key={`queue-${name}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: personality.accentColor,
                    boxShadow: `0 0 6px ${personality.accentColor}`,
                  }}
                />
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Agent desk slots */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '10px 8px',
          flex: 1,
        }}
      >
        <AnimatePresence>
          {LOCAL_AGENTS.map(name => {
            const isLive = liveAgentNames.includes(name)
            const personality = AGENT_PERSONALITIES[name] ?? AGENT_PERSONALITIES['general-purpose']
            const sprite = getAgentSprite(name)
            const frames = getAgentFrames(name)
            const accentColor = personality.accentColor

            return (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: isLive
                    ? `rgba(${hexToRgb(accentColor)}, 0.08)`
                    : 'transparent',
                  border: isLive
                    ? `1px solid ${accentColor}44`
                    : '1px solid transparent',
                  boxShadow: isLive
                    ? `0 0 12px ${accentColor}22`
                    : 'none',
                  transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
                  minWidth: 52,
                }}
              >
                {/* Status dot */}
                <div style={{ display: 'flex', justifyContent: 'center', height: 6 }}>
                  {isLive ? (
                    <span className="relative flex" style={{ width: 6, height: 6 }}>
                      <span
                        className="animate-ping absolute inline-flex rounded-full"
                        style={{ width: 6, height: 6, background: accentColor, opacity: 0.6 }}
                      />
                      <span
                        className="relative inline-flex rounded-full"
                        style={{ width: 6, height: 6, background: accentColor }}
                      />
                    </span>
                  ) : (
                    <span
                      style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(90,108,138,0.3)' }}
                    />
                  )}
                </div>

                {/* Sprite */}
                <PixelSprite
                  grid={sprite}
                  frames={frames}
                  animationState={isLive ? 'working' : 'idle'}
                  scale={SPRITE_SCALE}
                />

                {/* Name label */}
                <span
                  style={{
                    ...PIXEL_FONT,
                    fontSize: 5,
                    color: isLive ? accentColor : 'rgba(90,108,138,0.7)',
                    whiteSpace: 'nowrap',
                    maxWidth: 64,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Convert a hex color like #00FFC2 to "0,255,194" for rgba() */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `${r},${g},${b}`
}
