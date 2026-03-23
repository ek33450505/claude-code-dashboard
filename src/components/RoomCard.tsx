import { useEffect, useRef } from 'react'
import { TILE, IMPASSABLE } from '../engine/TileIds'
import type { RoomDef, RoomPalette } from '../engine/rooms/types'
import type { AgentEntity } from '../engine/AgentEntity'
import { AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import type { LiveAgent } from '../types'

// ─── Internal agent state (no AgentEntity dependency) ─────────────────────────

interface LocalAgent {
  name: string
  accentColor: string
  col: number
  row: number
  startCol: number
  startRow: number
  targetCol: number
  targetRow: number
  lerpT: number
  isActive: boolean
  frameOffset: number
  spawnCol: number
  spawnRow: number
  wanderCooldown: number
}

// ─── Drawing helpers ────────────────────────────────────────────────────────

function drawTile(
  ctx: CanvasRenderingContext2D,
  tileId: number,
  c: number,
  r: number,
  ts: number,
  palette: RoomPalette,
  t: number,
  wallPass: boolean,
) {
  const x = c * ts
  const y = r * ts

  if (!wallPass) {
    // Floor pass
    switch (tileId) {
      case TILE.FLOOR:
      case TILE.SPAWN: {
        const alt = (c + r) % 2 === 0
        ctx.fillStyle = alt ? palette.floor : palette.floorAlt
        ctx.fillRect(x, y, ts, ts)
        break
      }
      case TILE.GATHER: {
        const altG = (c + r) % 2 === 0
        ctx.fillStyle = altG ? palette.floor : palette.floorAlt
        ctx.fillRect(x, y, ts, ts)
        // Subtle glow circle
        const grad = ctx.createRadialGradient(x + ts / 2, y + ts / 2, 0, x + ts / 2, y + ts / 2, ts * 0.6)
        grad.addColorStop(0, palette.gather + '55')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(x + ts / 2, y + ts / 2, ts * 0.6, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      // All other tiles: draw floor beneath them
      case TILE.DESK:
      case TILE.MONITOR:
      case TILE.SERVER_RACK:
      case TILE.PLANT:
      case TILE.BOOKSHELF:
      case TILE.WHITEBOARD:
      case TILE.COFFEE:
      case TILE.MEETING_TBL:
      case TILE.WINDOW:
      case TILE.WALL_H:
      case TILE.WALL_V:
      case TILE.WALL_CORNER:
      case TILE.DOOR: {
        const altBase = (c + r) % 2 === 0
        ctx.fillStyle = altBase ? palette.floor : palette.floorAlt
        ctx.fillRect(x, y, ts, ts)
        break
      }
      case TILE.VOID:
      default:
        break
    }
    return
  }

  // Wall/furniture pass
  switch (tileId) {
    case TILE.WALL_H: {
      ctx.fillStyle = palette.wall
      ctx.fillRect(x, y, ts, ts)
      ctx.strokeStyle = palette.wallAccent
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1)
      break
    }
    case TILE.WALL_V: {
      ctx.fillStyle = palette.wall
      ctx.fillRect(x, y, ts, ts)
      ctx.strokeStyle = palette.wallAccent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 0.5, y)
      ctx.lineTo(x + 0.5, y + ts)
      ctx.moveTo(x + ts - 0.5, y)
      ctx.lineTo(x + ts - 0.5, y + ts)
      ctx.stroke()
      break
    }
    case TILE.WALL_CORNER: {
      ctx.fillStyle = palette.wall
      ctx.fillRect(x, y, ts, ts)
      ctx.strokeStyle = palette.wallAccent
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1)
      break
    }
    case TILE.DOOR: {
      // Floor already drawn; draw doorframe arch
      ctx.strokeStyle = palette.doorFrame
      ctx.lineWidth = Math.max(1, ts * 0.1)
      const archW = ts * 0.7
      const archX = x + (ts - archW) / 2
      ctx.beginPath()
      ctx.moveTo(archX, y + ts)
      ctx.lineTo(archX, y + ts * 0.4)
      ctx.arc(archX + archW / 2, y + ts * 0.4, archW / 2, Math.PI, 0, false)
      ctx.lineTo(archX + archW, y + ts)
      ctx.stroke()
      break
    }
    case TILE.DESK: {
      ctx.fillStyle = palette.desk
      ctx.fillRect(x + ts * 0.05, y + ts * 0.2, ts * 0.9, ts * 0.65)
      // Monitor screen with flicker
      const flicker = 0.7 + Math.sin(t * 0.15 + c + r) * 0.15
      ctx.fillStyle = palette.monitor
      ctx.globalAlpha = flicker
      ctx.fillRect(x + ts * 0.2, y + ts * 0.1, ts * 0.6, ts * 0.35)
      ctx.globalAlpha = 1
      break
    }
    case TILE.MONITOR: {
      const flickerM = 0.7 + Math.sin(t * 0.12 + c * 2 + r) * 0.15
      ctx.fillStyle = palette.desk
      ctx.fillRect(x + ts * 0.1, y + ts * 0.3, ts * 0.8, ts * 0.5)
      ctx.fillStyle = palette.monitor
      ctx.globalAlpha = flickerM
      ctx.fillRect(x + ts * 0.15, y + ts * 0.1, ts * 0.7, ts * 0.45)
      ctx.globalAlpha = 1
      break
    }
    case TILE.SERVER_RACK: {
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(x + ts * 0.1, y + ts * 0.05, ts * 0.8, ts * 0.9)
      const stripeColors = ['#00FF41', '#00D4FF', '#FF6B35', '#9B59B6']
      for (let i = 0; i < 4; i++) {
        const stripeY = y + ts * (0.12 + i * 0.2)
        const pulse = 0.6 + Math.sin(t * 0.1 + i * 1.2) * 0.4
        ctx.fillStyle = stripeColors[i]
        ctx.globalAlpha = pulse
        ctx.fillRect(x + ts * 0.15, stripeY, ts * 0.7, ts * 0.08)
        ctx.globalAlpha = 1
      }
      break
    }
    case TILE.PLANT: {
      // Brown stem
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(x + ts * 0.45, y + ts * 0.5, ts * 0.1, ts * 0.45)
      // Green foliage circles
      ctx.fillStyle = '#2D7A3A'
      ctx.beginPath()
      ctx.arc(x + ts * 0.5, y + ts * 0.38, ts * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#3EA64E'
      ctx.beginPath()
      ctx.arc(x + ts * 0.35, y + ts * 0.45, ts * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + ts * 0.65, y + ts * 0.45, ts * 0.2, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case TILE.BOOKSHELF: {
      ctx.fillStyle = '#5C3317'
      ctx.fillRect(x + ts * 0.05, y + ts * 0.05, ts * 0.9, ts * 0.9)
      const bookColors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C']
      const bookCount = Math.max(3, Math.floor(ts / 5))
      const bookW = (ts * 0.85) / bookCount
      for (let b = 0; b < bookCount; b++) {
        ctx.fillStyle = bookColors[b % bookColors.length]
        ctx.fillRect(
          x + ts * 0.075 + b * bookW + 1,
          y + ts * 0.12,
          bookW - 2,
          ts * 0.76,
        )
      }
      break
    }
    case TILE.WHITEBOARD: {
      ctx.fillStyle = '#F8F8F8'
      ctx.fillRect(x + ts * 0.05, y + ts * 0.1, ts * 0.9, ts * 0.8)
      ctx.strokeStyle = '#CCCCCC'
      ctx.lineWidth = 0.5
      for (let line = 1; line < 4; line++) {
        const ly = y + ts * (0.1 + (line * 0.18))
        ctx.beginPath()
        ctx.moveTo(x + ts * 0.1, ly)
        ctx.lineTo(x + ts * 0.9, ly)
        ctx.stroke()
      }
      ctx.strokeStyle = '#AAAAAA'
      ctx.lineWidth = 1
      ctx.strokeRect(x + ts * 0.05, y + ts * 0.1, ts * 0.9, ts * 0.8)
      break
    }
    case TILE.COFFEE: {
      // Cup body
      ctx.fillStyle = '#6F4E37'
      ctx.fillRect(x + ts * 0.3, y + ts * 0.45, ts * 0.4, ts * 0.45)
      // Steam
      const steamAlpha = 0.4 + Math.sin(t * 0.1) * 0.2
      ctx.strokeStyle = '#FFFFFF'
      ctx.globalAlpha = steamAlpha
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + ts * 0.4, y + ts * 0.38)
      ctx.quadraticCurveTo(x + ts * 0.35, y + ts * 0.28, x + ts * 0.4, y + ts * 0.18)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + ts * 0.6, y + ts * 0.38)
      ctx.quadraticCurveTo(x + ts * 0.65, y + ts * 0.28, x + ts * 0.6, y + ts * 0.18)
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
    case TILE.MEETING_TBL: {
      ctx.fillStyle = palette.desk
      ctx.fillRect(x + ts * 0.05, y + ts * 0.1, ts * 0.9, ts * 0.8)
      ctx.strokeStyle = palette.wallAccent + '44'
      ctx.lineWidth = 1
      ctx.strokeRect(x + ts * 0.1, y + ts * 0.15, ts * 0.8, ts * 0.7)
      break
    }
    case TILE.WINDOW: {
      ctx.fillStyle = palette.wall
      ctx.fillRect(x, y, ts, ts)
      ctx.fillStyle = '#B3D9F2'
      ctx.globalAlpha = 0.6
      ctx.fillRect(x + ts * 0.1, y + ts * 0.1, ts * 0.8, ts * 0.8)
      ctx.globalAlpha = 1
      // Window frame cross
      ctx.strokeStyle = palette.wallAccent
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + ts * 0.5, y + ts * 0.1)
      ctx.lineTo(x + ts * 0.5, y + ts * 0.9)
      ctx.moveTo(x + ts * 0.1, y + ts * 0.5)
      ctx.lineTo(x + ts * 0.9, y + ts * 0.5)
      ctx.stroke()
      break
    }
    case TILE.VOID:
    default:
      break
  }
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  ag: LocalAgent,
  ts: number,
  t: number,
) {
  const px = ag.col * ts + ts * 0.1
  const py = ag.row * ts - ts * 0.3
  const spriteW = ts * 0.8
  const spriteH = ts * 1.2

  // Shadow
  ctx.fillStyle = '#000'
  ctx.globalAlpha = 0.2
  ctx.beginPath()
  ctx.ellipse(px + spriteW / 2, py + spriteH + 2, spriteW / 2, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Walk cycle
  const walk = Math.floor((t * 0.06 + ag.frameOffset) % 2)

  // Legs
  ctx.fillStyle = '#334155'
  ctx.fillRect(px + spriteW * 0.2 + (walk ? 1 : 0), py + spriteH * 0.65, spriteW * 0.25, spriteH * 0.35)
  ctx.fillRect(px + spriteW * 0.55 - (walk ? 1 : 0), py + spriteH * 0.65, spriteW * 0.25, spriteH * 0.35)

  // Body
  ctx.fillStyle = ag.accentColor
  ctx.globalAlpha = ag.isActive ? 1 : 0.75
  ctx.fillRect(px + spriteW * 0.1, py + spriteH * 0.35, spriteW * 0.8, spriteH * 0.35)
  ctx.globalAlpha = 1

  // Head
  ctx.fillStyle = '#f5d0a9'
  ctx.fillRect(px + spriteW * 0.2, py, spriteW * 0.6, spriteH * 0.38)

  // Eyes — blink every ~90 frames
  const blink = Math.floor(t / 90) % 8 === 0
  ctx.fillStyle = '#1a1a1a'
  if (!blink) {
    ctx.fillRect(px + spriteW * 0.28, py + spriteH * 0.15, spriteW * 0.15, spriteH * 0.1)
    ctx.fillRect(px + spriteW * 0.57, py + spriteH * 0.15, spriteW * 0.15, spriteH * 0.1)
  }

  // Active glow ring
  if (ag.isActive) {
    ctx.strokeStyle = ag.accentColor
    ctx.globalAlpha = 0.4 + Math.sin(t * 0.08) * 0.2
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(px + spriteW / 2, py + spriteH * 0.5, spriteW * 0.7, spriteH * 0.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // Name label
  const fontSize = Math.max(6, Math.min(ts * 0.45, 10))
  ctx.fillStyle = ag.accentColor
  ctx.globalAlpha = 0.9
  ctx.font = `${fontSize}px "Courier New"`
  const labelW = ctx.measureText(ag.name).width
  ctx.fillText(ag.name, px + spriteW / 2 - labelW / 2, py - 2)
  ctx.globalAlpha = 1
}

function drawRoom(
  ctx: CanvasRenderingContext2D,
  room: RoomDef,
  ts: number,
  agents: LocalAgent[],
  t: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  // Pass 1: floors
  for (let r = 0; r < room.rows; r++) {
    for (let c = 0; c < room.cols; c++) {
      const tileId = room.tiles[r * room.cols + c]
      drawTile(ctx, tileId, c, r, ts, room.palette, t, false)
    }
  }

  // Pass 2: walls + furniture
  for (let r = 0; r < room.rows; r++) {
    for (let c = 0; c < room.cols; c++) {
      const tileId = room.tiles[r * room.cols + c]
      drawTile(ctx, tileId, c, r, ts, room.palette, t, true)
    }
  }

  // Pass 3: agents — depth sorted by row
  const sorted = [...agents].sort((a, b) => a.row - b.row)
  for (const ag of sorted) {
    drawAgent(ctx, ag, ts, t)
  }

  // Room label
  ctx.fillStyle = room.palette.wallAccent
  ctx.globalAlpha = 0.8
  ctx.font = `bold ${Math.max(8, ts - 4)}px "Courier New"`
  ctx.fillText(room.label, ts * 0.5, ts * 1.5)
  ctx.globalAlpha = 1
}

// ─── Helper: find a random walkable tile within radius ─────────────────────

function pickWanderTarget(
  room: RoomDef,
  spawnCol: number,
  spawnRow: number,
  radius = 4,
): { col: number; row: number } | null {
  for (let attempt = 0; attempt < 12; attempt++) {
    const dc = Math.round((Math.random() - 0.5) * radius * 2)
    const dr = Math.round((Math.random() - 0.5) * radius * 2)
    const col = Math.max(1, Math.min(room.cols - 2, spawnCol + dc))
    const row = Math.max(1, Math.min(room.rows - 2, spawnRow + dr))
    const tileId = room.tiles[row * room.cols + col]
    if (!IMPASSABLE.has(tileId as Parameters<typeof IMPASSABLE.has>[0])) {
      return { col, row }
    }
  }
  return null
}

// ─── Component props ────────────────────────────────────────────────────────

interface RoomCardProps {
  room: RoomDef
  liveAgents: LiveAgent[]
  onAgentClick?: (entity: AgentEntity, pos: { screenX: number; screenY: number }) => void
  className?: string
}

// ─── RoomCard component ─────────────────────────────────────────────────────

export default function RoomCard({ room, liveAgents, onAgentClick, className }: RoomCardProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const agentsRef = useRef<LocalAgent[]>([])
  const liveAgentsRef = useRef<LiveAgent[]>(liveAgents)
  const tileSizeRef = useRef<number>(16)

  // Keep liveAgentsRef current without restarting the RAF loop
  useEffect(() => {
    liveAgentsRef.current = liveAgents
  }, [liveAgents])

  // Main RAF loop — only re-runs when room changes
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Initialize agent list from room spawn points
    const initialAgents: LocalAgent[] = []
    for (const name of room.agents) {
      const spawn = room.spawnPoints[name]
      if (!spawn) continue
      const personality = AGENT_PERSONALITIES[name] ?? AGENT_PERSONALITIES['general-purpose']
      initialAgents.push({
        name,
        accentColor: personality.accentColor,
        col: spawn.col,
        row: spawn.row,
        startCol: spawn.col,
        startRow: spawn.row,
        targetCol: spawn.col,
        targetRow: spawn.row,
        lerpT: 1,
        isActive: false,
        frameOffset: Math.random() * 100,
        spawnCol: spawn.col,
        spawnRow: spawn.row,
        wanderCooldown: Math.random() * 3000,
      })
    }
    agentsRef.current = initialAgents

    // Set initial canvas size
    const { width, height } = container.getBoundingClientRect()
    const initW = width > 0 ? Math.round(width) : room.cols * 16
    const initH = height > 0 ? Math.round(height) : room.rows * 16
    canvas.width = initW
    canvas.height = initH
    tileSizeRef.current = Math.max(10, Math.min(40, Math.floor(Math.min(initW / room.cols, initH / room.rows))))

    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect
      if (w === 0 || h === 0) return
      const rw = Math.round(w)
      const rh = Math.round(h)
      canvas.width = rw
      canvas.height = rh
      tileSizeRef.current = Math.max(10, Math.min(40, Math.floor(Math.min(rw / room.cols, rh / room.rows))))
    })
    ro.observe(container)

    let rafId: number
    let lastTime = 0
    let running = true
    let t = 0

    const tick = (timestamp: number) => {
      if (!running) return
      const dt = lastTime === 0 ? 16 : Math.min(timestamp - lastTime, 100)
      lastTime = timestamp
      t++

      const ts = tileSizeRef.current
      const currentLive = liveAgentsRef.current

      for (const ag of agentsRef.current) {
        // Sync active state from live data
        ag.isActive = currentLive.some(
          la => la.agentType === ag.name && la.isActive,
        )

        // Advance lerp toward target
        if (ag.lerpT < 1) {
          const dist = Math.hypot(ag.targetCol - ag.startCol, ag.targetRow - ag.startRow)
          const speed = (dt / 1000) * 1.5
          ag.lerpT = Math.min(1, ag.lerpT + (dist > 0 ? speed / dist : 1))
          ag.col = ag.startCol + (ag.targetCol - ag.startCol) * ag.lerpT
          ag.row = ag.startRow + (ag.targetRow - ag.startRow) * ag.lerpT
        }

        // Wander logic
        if (ag.lerpT >= 1) {
          ag.wanderCooldown -= dt
          if (ag.wanderCooldown <= 0) {
            let newTarget: { col: number; row: number } | null = null
            if (ag.isActive) {
              newTarget = { col: room.gatherPoint.col, row: room.gatherPoint.row }
            } else {
              newTarget = pickWanderTarget(room, ag.spawnCol, ag.spawnRow, 4)
            }
            if (newTarget) {
              ag.startCol = ag.col
              ag.startRow = ag.row
              ag.targetCol = newTarget.col
              ag.targetRow = newTarget.row
              ag.lerpT = 0
            }
            ag.wanderCooldown = 3000 + Math.random() * 4000
          }
        }
      }

      // Draw
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingEnabled = false
        drawRoom(ctx, room, ts, agentsRef.current, t)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [room])

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onAgentClick) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const cx = (e.clientX - rect.left) * scaleX
    const cy = (e.clientY - rect.top) * scaleY
    const ts = tileSizeRef.current

    for (const ag of agentsRef.current) {
      const px = ag.col * ts + ts * 0.1
      const py = ag.row * ts - ts * 0.3
      const spriteW = ts * 0.8
      const spriteH = ts * 1.2

      if (cx >= px && cx <= px + spriteW && cy >= py && cy <= py + spriteH) {
        onAgentClick(
          {
            name: ag.name,
            accentColor: ag.accentColor,
            state: ag.isActive ? 'ACTIVE' : 'IDLE',
            isLive: ag.isActive,
            worldX: ag.col * ts,
            worldY: ag.row * ts,
            getBounds: () => ({ x: ag.col * ts, y: ag.row * ts, w: ts, h: ts * 1.2 }),
          } as unknown as AgentEntity,
          { screenX: e.clientX, screenY: e.clientY },
        )
        return
      }
    }
  }

  return (
    <div
      id={`room-card-${room.id}`}
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${room.cols} / ${room.rows}`,
        background: room.palette.floor,
        borderRadius: 8,
        border: `2px solid ${room.palette.wallAccent}30`,
        overflow: 'hidden',
      }}
      className={className}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }}
        onClick={handleClick}
      />
    </div>
  )
}
