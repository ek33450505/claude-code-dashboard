import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { AGENT_PERSONALITIES, getModelTier } from '../utils/agentPersonalities'

const PIXEL_FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

const STATE_COLORS: Record<string, string> = {
  ACTIVE:    '#00FFC2',
  GATHERING: '#00FFC2',
  WANDERING: '#60A5FA',
  REACTING:  '#F59E0B',
  IDLE:      '#5a6c8a',
}

export interface AgentDetailOverlayProps {
  agent: {
    name: string
    accentColor: string
    state: string
    isLive: boolean
  }
  screenPos: { screenX: number; screenY: number }
  liveData?: {
    task?: string
    model?: string
    duration?: string
    project?: string
  }
  onClose: () => void
}

const CARD_WIDTH = 240
const CARD_APPROX_HEIGHT = 180
const OFFSET_X = 12
const OFFSET_Y = -16

function clampX(x: number): number {
  const margin = 8
  return Math.min(Math.max(x, margin), window.innerWidth - CARD_WIDTH - margin)
}

function clampY(y: number): number {
  const margin = 8
  return Math.min(Math.max(y, margin), window.innerHeight - CARD_APPROX_HEIGHT - margin)
}

export function AgentDetailOverlay({ agent, screenPos, liveData, onClose }: AgentDetailOverlayProps) {
  const agentKey = agent.name.toLowerCase().replace(/\s+/g, '-')
  const personality = AGENT_PERSONALITIES[agentKey] ?? AGENT_PERSONALITIES['general-purpose']
  const modelTier = liveData?.model ? getModelTier(liveData.model) : null
  const stateColor = STATE_COLORS[agent.state] ?? '#5a6c8a'

  const left = clampX(screenPos.screenX + OFFSET_X)
  const top = clampY(screenPos.screenY + OFFSET_Y - CARD_APPROX_HEIGHT)

  const overlayRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, []) // empty deps — stable via ref

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        left,
        top,
        width: CARD_WIDTH,
        zIndex: 100,
        background: '#0d1117',
        border: `1px solid ${agent.accentColor}66`,
        borderRadius: 8,
        boxShadow: `0 0 16px ${agent.accentColor}22, 0 4px 24px rgba(0,0,0,0.6)`,
        padding: '10px 12px',
        userSelect: 'none',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#5a6c8a',
          fontSize: 12,
          lineHeight: 1,
          padding: 0,
        }}
      >
        ✕
      </button>

      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1 pr-4">
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: agent.accentColor,
            boxShadow: `0 0 5px ${agent.accentColor}`,
            flexShrink: 0,
          }}
        />
        <span
          className="truncate"
          style={{ ...PIXEL_FONT, fontSize: 7, color: '#E6E8EE', letterSpacing: '0.04em' }}
        >
          {agent.name}
        </span>
        <span
          style={{
            ...PIXEL_FONT,
            fontSize: 5,
            color: stateColor,
            background: `${stateColor}18`,
            border: `1px solid ${stateColor}44`,
            borderRadius: 3,
            padding: '1px 4px',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          {agent.state}
        </span>
      </div>

      {/* Role title + tagline */}
      <div style={{ ...PIXEL_FONT, fontSize: 6, color: agent.accentColor, marginBottom: 1 }}>
        {personality.roleTitle}
      </div>
      <div style={{ fontSize: 9, color: '#5a6c8a', marginBottom: 8, fontStyle: 'italic' }}>
        {personality.tagline}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }} />

      {/* Live data or idle */}
      {agent.isLive && liveData ? (
        <div className="flex flex-col gap-1.5">
          {liveData.task && (
            <div
              style={{
                fontSize: 9,
                color: '#88A3D6',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
              }}
            >
              {liveData.task}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {modelTier && (
              <span
                style={{
                  ...PIXEL_FONT,
                  fontSize: 5,
                  color: modelTier.color,
                  background: modelTier.bg,
                  borderRadius: 3,
                  padding: '2px 5px',
                }}
              >
                {modelTier.label}
              </span>
            )}
            {liveData.duration && (
              <span style={{ fontSize: 9, color: '#5a6c8a', fontFamily: 'monospace' }}>
                {liveData.duration}
              </span>
            )}
            {liveData.project && (
              <span
                className="truncate"
                style={{ fontSize: 9, color: '#5a6c8a', fontFamily: 'monospace', maxWidth: 100 }}
              >
                {liveData.project}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ ...PIXEL_FONT, fontSize: 6, color: '#374151', textAlign: 'center', padding: '4px 0' }}>
          IDLE
        </div>
      )}
    </motion.div>
  )
}
