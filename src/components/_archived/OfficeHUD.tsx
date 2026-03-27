// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getModelTier } from '../utils/agentPersonalities'

const PIXEL_FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }
const MAX_ROWS = 5

export interface OfficeHUDAgent {
  name: string
  accentColor: string
  task?: string
  model?: string
}

export interface OfficeHUDProps {
  activeAgents: OfficeHUDAgent[]
  onOpenPanel: () => void
}

export function OfficeHUD({ activeAgents, onOpenPanel }: OfficeHUDProps) {
  const [expanded, setExpanded] = useState(false)

  const count = activeAgents.length
  const visible = activeAgents.slice(0, MAX_ROWS)
  const overflow = count - MAX_ROWS

  const pillColor = count > 0 ? '#00FFC2' : '#5a6c8a'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 6,
      }}
    >
      {/* Expanded agent list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="hud-expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                background: '#0d1117',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
                minWidth: 220,
                padding: '8px 0',
              }}
            >
              {count === 0 ? (
                <div
                  style={{
                    ...PIXEL_FONT,
                    fontSize: 6,
                    color: '#374151',
                    textAlign: 'center',
                    padding: '8px 12px',
                  }}
                >
                  NO ACTIVE AGENTS
                </div>
              ) : (
                <>
                  {visible.map((a) => {
                    const tier = a.model ? getModelTier(a.model) : null
                    return (
                      <div
                        key={a.name}
                        className="flex items-center gap-2"
                        style={{ padding: '5px 12px' }}
                      >
                        {/* 8px colored square */}
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            background: a.accentColor,
                            flexShrink: 0,
                            imageRendering: 'pixelated',
                          }}
                        />
                        {/* Agent name */}
                        <span
                          style={{
                            ...PIXEL_FONT,
                            fontSize: 6,
                            color: '#E6E8EE',
                            flexShrink: 0,
                            maxWidth: 80,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.name}
                        </span>
                        {/* Model chip */}
                        {tier && (
                          <span
                            style={{
                              ...PIXEL_FONT,
                              fontSize: 5,
                              color: tier.color,
                              background: tier.bg,
                              borderRadius: 3,
                              padding: '1px 4px',
                              flexShrink: 0,
                            }}
                          >
                            {tier.label}
                          </span>
                        )}
                        {/* Task */}
                        {a.task && (
                          <span
                            style={{
                              fontSize: 9,
                              color: '#5a6c8a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {a.task}
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {overflow > 0 && (
                    <div
                      style={{
                        ...PIXEL_FONT,
                        fontSize: 5,
                        color: '#5a6c8a',
                        padding: '4px 12px',
                      }}
                    >
                      + {overflow} MORE
                    </div>
                  )}
                  {/* Side panel link */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 6, paddingTop: 6 }}>
                    <button
                      onClick={() => { setExpanded(false); onOpenPanel() }}
                      style={{
                        ...PIXEL_FONT,
                        fontSize: 6,
                        color: '#00FFC2',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 12px',
                        width: '100%',
                        textAlign: 'right',
                        letterSpacing: '0.05em',
                      }}
                    >
                      SIDE PANEL →
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pill button */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: '#0d1117',
          border: `1px solid ${pillColor}44`,
          borderRadius: 999,
          padding: '7px 14px',
          cursor: 'pointer',
          boxShadow: count > 0 ? `0 0 10px ${pillColor}22` : 'none',
          transition: 'box-shadow 0.3s',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: pillColor,
            boxShadow: count > 0 ? `0 0 6px ${pillColor}` : 'none',
            transition: 'background-color 0.3s, box-shadow 0.3s',
          }}
        />
        <span style={{ ...PIXEL_FONT, fontSize: 7, color: pillColor }}>
          {count} ACTIVE
        </span>
        <span style={{ fontSize: 14, color: '#5a6c8a', lineHeight: 1 }}>≡</span>
      </button>
    </div>
  )
}
