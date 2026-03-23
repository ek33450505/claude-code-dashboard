import { useState } from 'react'
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
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border)',
        background: '#0a0f16',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Queue zone — sticky left */}
      <div
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 3,
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
          alignSelf: 'stretch',
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
          overflowY: 'visible',
          padding: '10px 8px',
          flex: 1,
        }}
      >
        {LOCAL_AGENTS.map(name => {
          const isLive = liveAgentNames.includes(name)
          const isSelected = selected === name
          const personality = AGENT_PERSONALITIES[name] ?? AGENT_PERSONALITIES['general-purpose']
          const sprite = getAgentSprite(name)
          const frames = getAgentFrames(name)
          const accentColor = personality.accentColor

          return (
            <div key={name} style={{ position: 'relative', flexShrink: 0 }}>
              <motion.button
                onClick={() => setSelected(isSelected ? null : name)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isSelected
                    ? `rgba(${hexToRgb(accentColor)}, 0.14)`
                    : isLive
                    ? `rgba(${hexToRgb(accentColor)}, 0.08)`
                    : 'transparent',
                  border: isSelected
                    ? `1px solid ${accentColor}88`
                    : isLive
                    ? `1px solid ${accentColor}44`
                    : '1px solid transparent',
                  boxShadow: isSelected
                    ? `0 0 16px ${accentColor}40`
                    : isLive
                    ? `0 0 10px ${accentColor}22`
                    : 'none',
                  transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                  minWidth: 52,
                }}
              >
                {/* Sprite */}
                <PixelSprite
                  grid={sprite}
                  frames={frames}
                  animationState={isLive ? 'working' : 'idle'}
                  scale={SPRITE_SCALE}
                />

                {/* Name + status dot row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {isLive ? (
                    <span className="relative flex" style={{ width: 5, height: 5, flexShrink: 0 }}>
                      <span
                        className="animate-ping absolute inline-flex rounded-full"
                        style={{ width: 5, height: 5, background: accentColor, opacity: 0.7 }}
                      />
                      <span
                        className="relative inline-flex rounded-full"
                        style={{ width: 5, height: 5, background: accentColor }}
                      />
                    </span>
                  ) : (
                    <span style={{ width: 5, height: 5, flexShrink: 0, borderRadius: '50%', background: 'rgba(90,108,138,0.25)' }} />
                  )}
                  <span
                    style={{
                      ...PIXEL_FONT,
                      fontSize: 5,
                      color: isLive ? accentColor : 'rgba(90,108,138,0.7)',
                      whiteSpace: 'nowrap',
                      maxWidth: 60,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {name}
                  </span>
                </div>
              </motion.button>

              {/* Info popover */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    key="popover"
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 20,
                      minWidth: 160,
                      background: '#0d1117',
                      border: `1px solid ${accentColor}66`,
                      borderRadius: 8,
                      padding: '10px 12px',
                      boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 16px ${accentColor}18`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {/* Triangle pointer */}
                    <div style={{
                      position: 'absolute',
                      top: -5,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderBottom: `5px solid ${accentColor}66`,
                    }} />

                    <span style={{ ...PIXEL_FONT, fontSize: 7, color: accentColor }}>
                      {personality.roleTitle}
                    </span>
                    <span style={{ ...PIXEL_FONT, fontSize: 5, color: 'rgba(148,163,184,0.8)', lineHeight: 1.8 }}>
                      {personality.tagline}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{
                        ...PIXEL_FONT,
                        fontSize: 5,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isLive ? `${accentColor}22` : 'rgba(90,108,138,0.15)',
                        color: isLive ? accentColor : 'rgba(90,108,138,0.8)',
                        border: `1px solid ${isLive ? accentColor + '44' : 'rgba(90,108,138,0.25)'}`,
                      }}>
                        {isLive ? 'ACTIVE' : 'IDLE'}
                      </span>
                      <span style={{ ...PIXEL_FONT, fontSize: 5, color: 'rgba(90,108,138,0.6)' }}>
                        {personality.archetype}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
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
