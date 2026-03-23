import { forwardRef, useImperativeHandle } from 'react'
import { useLiveAgents } from '../api/useLiveAgents'
import { ROOMS } from '../engine/rooms'
import RoomCard from './RoomCard'
import type { AgentEntity } from '../engine/AgentEntity'

export interface GameWorldHandle {
  jumpToRoom: (roomId: string) => void
}

interface GameWorldProps {
  className?: string
  onAgentClick?: (entity: AgentEntity | null, pos: { screenX: number; screenY: number } | null) => void
}

const GameWorld = forwardRef<GameWorldHandle, GameWorldProps>(function GameWorld(
  { className, onAgentClick },
  ref,
) {
  const { data: liveAgents = [] } = useLiveAgents()

  useImperativeHandle(ref, () => ({
    jumpToRoom: (roomId: string) => {
      document.getElementById(`room-card-${roomId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  }))

  const room = ROOMS[0]
  const activeAgents = liveAgents.filter(a => a.isActive)

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 12,
        padding: 12,
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Main office canvas — fills available space */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <RoomCard
          key={room.id}
          room={room}
          liveAgents={liveAgents}
          onAgentClick={onAgentClick ?? undefined}
        />
      </div>

      {/* Active agents sidebar */}
      <div style={{
        width: 180,
        flexShrink: 0,
        background: '#0d111780',
        borderRadius: 8,
        border: '1px solid #1e293b',
        padding: '8px 10px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#64748b',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 4,
        }}>
          Active Agents
        </div>
        {activeAgents.length === 0 && (
          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
            All agents idle
          </div>
        )}
        {activeAgents.map(agent => (
          <div
            key={agent.agentType}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 6px',
              borderRadius: 4,
              background: '#1e293b40',
              cursor: 'pointer',
            }}
            onClick={() => {
              // Scroll to the room (it's the only one)
              document.getElementById(`room-card-${room.id}`)?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 6px #22c55e80',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 11,
              color: '#e2e8f0',
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {agent.agentType}
            </span>
          </div>
        ))}
        <div style={{
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: '1px solid #1e293b',
          fontSize: 10,
          color: '#475569',
          fontFamily: 'monospace',
        }}>
          {room.agents.length} agents · {activeAgents.length} working
        </div>
      </div>
    </div>
  )
})

export default GameWorld
