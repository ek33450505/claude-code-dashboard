import { useState } from 'react'
import { motion } from 'framer-motion'

const PIXEL_FONT: React.CSSProperties = { fontFamily: "'Press Start 2P', monospace" }

export interface RoomNavRoom {
  id: string
  label: string
  palette: { wallAccent: string }
}

export interface RoomNavProps {
  rooms: RoomNavRoom[]
  activeRoomId: string
  onRoomSelect: (roomId: string) => void
}

export function RoomNav({ rooms, activeRoomId, onRoomSelect }: RoomNavProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'rgba(13,17,23,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 999,
        padding: '7px 18px',
      }}
    >
      {rooms.map((room) => {
        const isActive = room.id === activeRoomId
        const isHovered = hoveredId === room.id
        const accent = room.palette.wallAccent

        return (
          <div
            key={room.id}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* Dot */}
            <motion.button
              onClick={() => onRoomSelect(room.id)}
              onHoverStart={() => setHoveredId(room.id)}
              onHoverEnd={() => setHoveredId(null)}
              aria-label={room.label}
              whileHover={{ scale: 1.25 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                position: 'relative',
                width: isActive ? 10 : 7,
                height: isActive ? 10 : 7,
                transition: 'width 0.2s, height 0.2s',
              }}
            >
              {/* Pulse ring for active */}
              {isActive && (
                <motion.span
                  animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: `1.5px solid ${accent}`,
                    pointerEvents: 'none',
                  }}
                />
              )}
              {/* Dot circle */}
              <span
                style={{
                  display: 'block',
                  width: isActive ? 10 : isHovered ? 9 : 7,
                  height: isActive ? 10 : isHovered ? 9 : 7,
                  borderRadius: '50%',
                  background: isActive ? accent : '#1e293b',
                  border: `1.5px solid ${isActive ? accent : `${accent}66`}`,
                  boxShadow: isActive ? `0 0 6px ${accent}88` : 'none',
                  transition: 'width 0.15s, height 0.15s, background 0.15s, box-shadow 0.15s',
                }}
              />
            </motion.button>

            {/* Tooltip label */}
            {isHovered && !isActive && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  marginTop: 6,
                  ...PIXEL_FONT,
                  fontSize: 5,
                  color: accent,
                  whiteSpace: 'nowrap',
                  background: '#0d1117',
                  border: `1px solid ${accent}44`,
                  borderRadius: 4,
                  padding: '3px 6px',
                  pointerEvents: 'none',
                  letterSpacing: '0.04em',
                }}
              >
                {room.label.toUpperCase()}
              </motion.div>
            )}

            {/* Active label shown below active dot */}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  marginTop: 6,
                  ...PIXEL_FONT,
                  fontSize: 5,
                  color: accent,
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.04em',
                  pointerEvents: 'none',
                }}
              >
                {room.label.toUpperCase()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
