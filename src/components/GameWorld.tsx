import { useEffect, useRef } from 'react'
import { useLiveAgents } from '../api/useLiveAgents'
import { ROOMS, WORLD_WIDTH_PX, WORLD_HEIGHT_PX } from '../engine/rooms'
import { Camera } from '../engine/Camera'
import { TileRenderer } from '../engine/TileRenderer'
import { GameLoop } from '../engine/GameLoop'
import { AgentEntity } from '../engine/AgentEntity'
import { getAgentFrames, getAgentSprite, AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import type { SpriteFrames } from '../engine/AgentEntity'

const VIEWPORT_W = 960
const VIEWPORT_H = 240

function buildSpriteFrames(agentName: string): SpriteFrames {
  const frames = getAgentFrames(agentName)
  const baseSprite = getAgentSprite(agentName)

  // Ensure we always have all three frame sets
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

export default function GameWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loopRef = useRef<GameLoop | null>(null)
  const { data: liveAgents } = useLiveAgents()

  // Bootstrap engine once
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = VIEWPORT_W
    canvas.height = VIEWPORT_H

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.imageSmoothingEnabled = false

    const camera = new Camera({
      viewportW: VIEWPORT_W,
      viewportH: VIEWPORT_H,
      worldW: WORLD_WIDTH_PX,
      worldH: WORLD_HEIGHT_PX,
      lerpFactor: 0.08,
    })

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

    return () => {
      loop.stop()
      loopRef.current = null
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

  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border)]"
      style={{ width: VIEWPORT_W, maxWidth: '100%', height: VIEWPORT_H, background: '#0a0a0a' }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}
