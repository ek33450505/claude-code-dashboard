import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useLiveAgents } from '../api/useLiveAgents'
import { ROOMS, WORLD_WIDTH_PX, WORLD_HEIGHT_PX } from '../engine/rooms'
import { Camera } from '../engine/Camera'
import { TileRenderer } from '../engine/TileRenderer'
import { GameLoop } from '../engine/GameLoop'
import { AgentEntity } from '../engine/AgentEntity'
import { getAgentFrames, getAgentSprite, AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import type { SpriteFrames } from '../engine/AgentEntity'

export interface GameWorldHandle {
  jumpToRoom: (roomId: string) => void
}

interface GameWorldProps {
  className?: string
  onAgentClick?: (entity: AgentEntity | null, pos: { screenX: number; screenY: number } | null) => void
}

function buildSpriteFrames(agentName: string): SpriteFrames {
  const frames = getAgentFrames(agentName)
  const baseSprite = getAgentSprite(agentName)

  const idle: string[][][] = frames.idle && frames.idle.length > 0
    ? frames.idle
    : [baseSprite, baseSprite]

  const working: string[][][] = frames.working && frames.working.length > 0
    ? frames.working
    : [baseSprite]

  const reacting: string[][][] = frames.reacting && frames.reacting.length > 0
    ? frames.reacting
    : [baseSprite]

  return { idle, working, reacting }
}

function buildEntities(): AgentEntity[] {
  const entities: AgentEntity[] = []

  for (const room of ROOMS) {
    for (const agentName of room.agents) {
      const spawnTile = room.spawnPoints[agentName]
      if (!spawnTile) continue

      const personality = AGENT_PERSONALITIES[agentName] ?? AGENT_PERSONALITIES['general-purpose']
      const spriteFrames = buildSpriteFrames(agentName)

      entities.push(new AgentEntity({
        name: agentName,
        room,
        spawnTile,
        accentColor: personality.accentColor,
        spriteFrames,
      }))
    }
  }

  return entities
}

const GameWorld = forwardRef<GameWorldHandle, GameWorldProps>(function GameWorld(
  { className, onAgentClick },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const { data: liveAgents } = useLiveAgents()

  useImperativeHandle(ref, () => ({
    jumpToRoom(roomId: string) {
      const room = ROOMS.find(r => r.id === roomId)
      if (!room) return
      loopRef.current?.jumpToRoom(room.worldOffset.x)
    },
  }))

  // Bootstrap engine once
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const { width, height } = container.getBoundingClientRect()
    const initW = width > 0 ? Math.round(width) : 960
    const initH = height > 0 ? Math.round(height) : 240

    canvas.width = initW
    canvas.height = initH
    canvas.style.width = `${initW}px`
    canvas.style.height = `${initH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    const camera = new Camera({
      viewportW: initW,
      viewportH: initH,
      worldW: WORLD_WIDTH_PX,
      worldH: WORLD_HEIGHT_PX,
      lerpFactor: 0.08,
    })

    cameraRef.current = camera

    const renderer = new TileRenderer(ctx)
    const entities = buildEntities()

    const loop = new GameLoop({
      canvas,
      ctx,
      rooms: ROOMS,
      entities,
      camera,
      renderer,
    })

    loopRef.current = loop
    loop.start()

    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect
      if (w === 0 || h === 0) return
      const rw = Math.round(w)
      const rh = Math.round(h)
      canvas.width = rw
      canvas.height = rh
      canvas.style.width = `${rw}px`
      canvas.style.height = `${rh}px`
      loopRef.current?.resizeViewport(rw, rh)
    })

    ro.observe(container)

    return () => {
      ro.disconnect()
      loop.stop()
      loopRef.current = null
      cameraRef.current = null
    }
  }, [])

  // Inject live agent data whenever it changes
  useEffect(() => {
    if (!loopRef.current || !liveAgents) return
    const snapshots = liveAgents.map(a => ({
      agentType: a.agentType,
      isActive: a.isActive,
    }))
    loopRef.current.setLiveAgents(snapshots)
  }, [liveAgents])

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onAgentClick) return
    const canvas = canvasRef.current
    const camera = cameraRef.current
    const loop = loopRef.current
    if (!canvas || !camera || !loop) return

    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    // Scale from CSS pixels to canvas pixels
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const canvasX = cx * scaleX
    const canvasY = cy * scaleY

    // Convert to world coordinates
    const wx = canvasX + camera.x
    const wy = canvasY + camera.y

    const HITBOX_EXPAND = 4
    for (const entity of loop.getEntities()) {
      const b = entity.getBounds()
      if (
        wx >= b.x - HITBOX_EXPAND &&
        wx <= b.x + b.w + HITBOX_EXPAND &&
        wy >= b.y - HITBOX_EXPAND &&
        wy <= b.y + b.h + HITBOX_EXPAND
      ) {
        onAgentClick(entity, { screenX: e.clientX, screenY: e.clientY })
        return
      }
    }

    onAgentClick(null, null)
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          display: 'block',
          imageRendering: 'pixelated',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  )
})

export default GameWorld
