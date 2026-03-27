// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import type { RoomDef, TileCoord } from './rooms/types'
import { Pathfinder, type PathNode, type PathfinderGrid } from './Pathfinder'
import { IMPASSABLE } from './TileIds'

export type AgentState = 'IDLE' | 'WANDERING' | 'ACTIVE' | 'GATHERING' | 'REACTING'

export interface SpriteFrames {
  idle: string[][][]
  working: string[][][]
  reacting: string[][][]
}

export interface LiveAgentData {
  agentType?: string
  isActive: boolean
}

export class AgentEntity {
  readonly name: string
  readonly accentColor: string
  readonly room: RoomDef

  worldX: number
  worldY: number
  state: AgentState = 'IDLE'
  isLive = false

  private frameIndex = 0
  private frameTimer = 0

  private path: PathNode[] = []
  private pathIndex = 0
  private prevTileX = 0
  private prevTileY = 0
  private nextTileX = 0
  private nextTileY = 0
  private moveProgress = 1

  private wanderTimer = 0
  private wanderInterval = 4000

  private spriteFrames: SpriteFrames
  private spawnTile: TileCoord
  private grid: PathfinderGrid

  constructor(config: {
    name: string
    room: RoomDef
    spawnTile: TileCoord
    accentColor: string
    spriteFrames: SpriteFrames
  }) {
    this.name = config.name
    this.room = config.room
    this.accentColor = config.accentColor
    this.spriteFrames = config.spriteFrames
    this.spawnTile = config.spawnTile
    this.grid = { tiles: config.room.tiles, cols: config.room.cols, rows: config.room.rows }
    const ox = config.room.worldOffset.x
    const oy = config.room.worldOffset.y
    this.worldX = ox + config.spawnTile.col * 16
    this.worldY = oy + config.spawnTile.row * 16
    this.prevTileX = this.worldX
    this.prevTileY = this.worldY
    this.nextTileX = this.worldX
    this.nextTileY = this.worldY
    this.wanderTimer = Math.random() * 4000
    this.wanderInterval = 3000 + Math.random() * 5000
  }

  update(dt: number, liveData: LiveAgentData | null) {
    const cappedDt = Math.min(dt, 100)
    const wasLive = this.isLive
    this.isLive = liveData !== null && liveData.isActive

    // State transitions from live data change
    if (!wasLive && this.isLive && this.state !== 'ACTIVE') this.transitionTo('ACTIVE')
    if (wasLive && !this.isLive && (this.state === 'ACTIVE' || this.state === 'GATHERING')) {
      this.transitionTo('REACTING')
    }

    // Frame animation
    this.frameTimer += cappedDt
    const duration = this.state === 'ACTIVE' ? 250 : this.state === 'REACTING' ? 150 : 500
    if (this.frameTimer >= duration) {
      this.frameTimer = 0
      const frames = this.getCurrentFrameSet()
      if (frames.length > 0) {
        this.frameIndex = (this.frameIndex + 1) % frames.length
        if (this.state === 'REACTING' && this.frameIndex === 0) {
          this.transitionTo('IDLE')
        }
      }
    }

    this.advanceAlongPath(cappedDt)

    // State-specific behavior
    if (this.state === 'IDLE' || this.state === 'WANDERING') {
      this.wanderTimer -= cappedDt
      if (this.wanderTimer <= 0 && this.moveProgress >= 1) {
        this.wanderTimer = this.wanderInterval
        this.pickAndStartWander()
        if (this.path.length > 0) this.transitionTo('WANDERING')
      }
    }

    if (this.state === 'WANDERING' && this.path.length === 0 && this.moveProgress >= 1) {
      this.transitionTo('IDLE')
    }
  }

  getCurrentFrame(): string[][] {
    const frames = this.getCurrentFrameSet()
    if (!frames.length) return []
    return frames[Math.min(this.frameIndex, frames.length - 1)]
  }

  getBounds() {
    return { x: this.worldX, y: this.worldY, w: 16, h: 20 }
  }

  private getCurrentFrameSet(): string[][][] {
    if (this.state === 'ACTIVE' || this.state === 'GATHERING') return this.spriteFrames.working
    if (this.state === 'REACTING') return this.spriteFrames.reacting
    return this.spriteFrames.idle
  }

  private transitionTo(next: AgentState) {
    this.state = next
    this.frameIndex = 0
    this.frameTimer = 0
    if (next === 'ACTIVE') {
      const gp = this.room.gatherPoint
      const start = this.currentTile()
      this.path = Pathfinder.findPath(this.grid, start, gp)
      this.pathIndex = 0
    }
    if (next === 'IDLE') {
      this.path = []
      this.wanderTimer = this.wanderInterval
    }
  }

  private currentTile(): PathNode {
    const ox = this.room.worldOffset.x
    const oy = this.room.worldOffset.y
    return {
      col: Math.round((this.worldX - ox) / 16),
      row: Math.round((this.worldY - oy) / 16),
    }
  }

  private pickAndStartWander() {
    const spawn = this.spawnTile
    const radius = 4
    for (let attempt = 0; attempt < 10; attempt++) {
      const dc = Math.round((Math.random() - 0.5) * radius * 2)
      const dr = Math.round((Math.random() - 0.5) * radius * 2)
      const col = Math.max(1, Math.min(this.room.cols - 2, spawn.col + dc))
      const row = Math.max(1, Math.min(this.room.rows - 2, spawn.row + dr))
      const tileId = this.grid.tiles[row * this.room.cols + col]
      if (!IMPASSABLE.has(tileId)) {
        const start = this.currentTile()
        const path = Pathfinder.findPath(this.grid, start, { col, row })
        if (path.length > 0) { this.path = path; this.pathIndex = 0; return }
      }
    }
  }

  private advanceAlongPath(dt: number) {
    if (this.path.length === 0 || this.pathIndex >= this.path.length) return
    const speed = 3 // tiles per second
    this.moveProgress += (dt / 1000) * speed
    if (this.moveProgress >= 1) {
      this.worldX = this.nextTileX
      this.worldY = this.nextTileY
      this.prevTileX = this.nextTileX
      this.prevTileY = this.nextTileY
      this.pathIndex++
      if (this.pathIndex >= this.path.length) {
        this.path = []
        if (this.state === 'ACTIVE') this.transitionTo('GATHERING')
        return
      }
      const node = this.path[this.pathIndex]
      const ox = this.room.worldOffset.x
      const oy = this.room.worldOffset.y
      this.nextTileX = ox + node.col * 16
      this.nextTileY = oy + node.row * 16
      this.moveProgress -= 1
    }
    this.worldX = this.prevTileX + (this.nextTileX - this.prevTileX) * this.moveProgress
    this.worldY = this.prevTileY + (this.nextTileY - this.prevTileY) * this.moveProgress
  }
}