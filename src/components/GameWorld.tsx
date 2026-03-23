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

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        padding: 12,
        alignContent: 'start',
      }}
    >
      {ROOMS.map(room => (
        <RoomCard
          key={room.id}
          room={room}
          liveAgents={liveAgents}
          onAgentClick={onAgentClick ?? undefined}
        />
      ))}
    </div>
  )
})

export default GameWorld
