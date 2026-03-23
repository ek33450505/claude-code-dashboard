import type { Camera } from './Camera'
import type { TileRenderer } from './TileRenderer'
import type { AgentEntity } from './AgentEntity'
import type { RoomDef } from './rooms/types'

export interface LiveAgentSnapshot {
  agentType?: string
  isActive: boolean
}

export class GameLoop {
  private rafId: number | null = null
  private lastTime = 0
  private running = false
  private liveAgents: LiveAgentSnapshot[] = []

  constructor(private config: {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    rooms: RoomDef[]
    entities: AgentEntity[]
    camera: Camera
    renderer: TileRenderer
  }) {}

  start() {
    if (this.running) return
    this.running = true
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop() {
    this.running = false
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null }
  }

  setLiveAgents(agents: LiveAgentSnapshot[]) {
    this.liveAgents = agents
  }

  private tick = (timestamp: number) => {
    if (!this.running) return
    const dt = Math.min(timestamp - (this.lastTime || timestamp), 100)
    this.lastTime = timestamp
    this.update(dt)
    this.draw()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private update(dt: number) {
    for (const entity of this.config.entities) {
      const live = this.liveAgents.find(a => a.agentType === entity.name) ?? null
      entity.update(dt, live)
    }
    // Camera: focus on most recently active entity
    const active = this.config.entities.filter(e => e.state === 'ACTIVE' || e.state === 'GATHERING')
    if (active.length > 0) {
      const e = active[0]
      this.config.camera.setTarget(e.worldX - 480, e.worldY - 112)
    }
    this.config.camera.update()
  }

  private draw() {
    const { ctx, canvas, rooms, entities, camera, renderer } = this.config
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderer.drawWorld(rooms, camera)
    renderer.drawAgents(entities, camera)
  }
}
