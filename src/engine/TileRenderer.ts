import { TILE } from './TileIds'
import type { TileId } from './TileIds'
import type { RoomDef, RoomPalette } from './rooms/types'
import type { Camera } from './Camera'
import type { AgentEntity } from './AgentEntity'

const TILE_SIZE = 16

// Color key map for sprite rendering
const COLOR_KEYS: Record<string, string | null> = {
  'K': '#0a0a0a',
  'S': '#f5d0a9',
  'E': '#1a1a1a',
  'W': '#ffffff',
  '.': null,
  '': null,
}

export class TileRenderer {
  private ctx: CanvasRenderingContext2D
  private sortBuffer: AgentEntity[] = []

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }

  drawWorld(rooms: RoomDef[], camera: Camera) {
    for (const room of rooms) {
      this.drawRoom(room, camera)
    }
    // Draw room labels after all rooms
    for (const room of rooms) {
      this.drawRoomLabel(room, camera)
    }
  }

  private drawRoom(room: RoomDef, camera: Camera) {
    const { cols, rows, tiles, worldOffset, palette } = room
    const ox = worldOffset.x
    const oy = worldOffset.y

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const wx = ox + col * TILE_SIZE
        const wy = oy + row * TILE_SIZE
        if (!camera.isVisible(wx, wy, TILE_SIZE, TILE_SIZE)) continue
        const tileId = tiles[row * cols + col] as TileId
        this.drawTile(tileId, wx, wy, palette, col, row, camera)
      }
    }
  }

  private drawTile(
    tileId: TileId,
    wx: number,
    wy: number,
    palette: RoomPalette,
    col: number,
    row: number,
    camera: Camera
  ) {
    const sx = Math.floor(camera.toScreenX(wx))
    const sy = Math.floor(camera.toScreenY(wy))
    const ctx = this.ctx
    const T = TILE_SIZE

    switch (tileId) {
      case TILE.FLOOR:
      case TILE.SPAWN: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        break
      }
      case TILE.GATHER: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Subtle gather circle
        ctx.fillStyle = palette.gather
        ctx.beginPath()
        ctx.arc(sx + T / 2, sy + T / 2, T / 2 - 1, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case TILE.WALL_H: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // Accent line on top
        ctx.fillStyle = palette.wallAccent
        ctx.fillRect(sx, sy, T, 1)
        break
      }
      case TILE.WALL_V: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // Accent line on left
        ctx.fillStyle = palette.wallAccent
        ctx.fillRect(sx, sy, 1, T)
        break
      }
      case TILE.WALL_CORNER: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // Corner accent
        ctx.fillStyle = palette.wallAccent
        ctx.fillRect(sx, sy, T, 1)
        ctx.fillRect(sx, sy, 1, T)
        break
      }
      case TILE.WINDOW: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // Glass pane
        ctx.fillStyle = palette.wallAccent + '30'
        ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4)
        ctx.fillStyle = palette.wallAccent
        ctx.fillRect(sx + 1, sy + 1, T - 2, 1)
        ctx.fillRect(sx + 1, sy + T - 2, T - 2, 1)
        ctx.fillRect(sx + 1, sy + 1, 1, T - 2)
        ctx.fillRect(sx + T - 2, sy + 1, 1, T - 2)
        break
      }
      case TILE.DOOR: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Door arch outline
        ctx.fillStyle = palette.doorFrame
        ctx.fillRect(sx, sy, T, 1)
        ctx.fillRect(sx, sy, 1, T)
        ctx.fillRect(sx + T - 1, sy, 1, T)
        break
      }
      case TILE.DESK: {
        // Floor behind desk
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Desk surface
        ctx.fillStyle = palette.desk
        ctx.fillRect(sx + 1, sy + 3, T - 2, T - 5)
        // Monitor screen glow
        ctx.fillStyle = palette.monitor
        ctx.fillRect(sx + 3, sy + 5, T - 6, 5)
        // Monitor glow bloom
        ctx.fillStyle = palette.monitor + '40'
        ctx.fillRect(sx + 2, sy + 4, T - 4, 7)
        break
      }
      case TILE.MONITOR: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        ctx.fillStyle = palette.monitor
        ctx.fillRect(sx + 2, sy + 2, T - 4, T - 6)
        break
      }
      case TILE.BOOKSHELF: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // Book spines — alternating colors
        const bookColors = [palette.wallAccent, palette.monitor, '#ff8f6b', '#7ec8e3', palette.wallAccent]
        const bookW = 2
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = bookColors[i % bookColors.length]
          ctx.fillRect(sx + 2 + i * (bookW + 1), sy + 3, bookW, T - 6)
        }
        break
      }
      case TILE.SERVER_RACK: {
        ctx.fillStyle = '#0a0f12'
        ctx.fillRect(sx, sy, T, T)
        // Horizontal stripe LEDs
        const ledColors = [palette.wallAccent, palette.monitor, '#ff5555']
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = ledColors[i % ledColors.length]
          ctx.fillRect(sx + 2, sy + 2 + i * 3, T - 4, 1)
        }
        // Rack frame
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(sx, sy, 1, T)
        ctx.fillRect(sx + T - 1, sy, 1, T)
        break
      }
      case TILE.PLANT: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Pot
        ctx.fillStyle = '#8b4513'
        ctx.fillRect(sx + 4, sy + 10, T - 8, 4)
        // Stem
        ctx.fillStyle = '#2d6a2d'
        ctx.fillRect(sx + 7, sy + 5, 2, 6)
        // Leaves — circle approximation
        ctx.fillStyle = '#3a9a3a'
        ctx.beginPath()
        ctx.arc(sx + 8, sy + 5, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2d7a2d'
        ctx.beginPath()
        ctx.arc(sx + 5, sy + 7, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#4aaa4a'
        ctx.beginPath()
        ctx.arc(sx + 11, sy + 6, 3, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case TILE.COFFEE: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Cup
        ctx.fillStyle = '#8b7355'
        ctx.fillRect(sx + 4, sy + 7, T - 8, T - 9)
        // Coffee surface
        ctx.fillStyle = '#6b4226'
        ctx.fillRect(sx + 5, sy + 8, T - 10, 2)
        // Steam wisps
        ctx.fillStyle = '#ffffff30'
        ctx.fillRect(sx + 6, sy + 4, 1, 2)
        ctx.fillRect(sx + 9, sy + 3, 1, 3)
        break
      }
      case TILE.WHITEBOARD: {
        ctx.fillStyle = palette.wall
        ctx.fillRect(sx, sy, T, T)
        // White board surface
        ctx.fillStyle = '#e8e8e0'
        ctx.fillRect(sx + 1, sy + 2, T - 2, T - 5)
        // Lines
        ctx.fillStyle = '#c0c0b8'
        ctx.fillRect(sx + 2, sy + 5, T - 4, 1)
        ctx.fillRect(sx + 2, sy + 8, T - 4, 1)
        ctx.fillRect(sx + 2, sy + 11, T - 4, 1)
        break
      }
      case TILE.MEETING_TBL: {
        const isAlt = (col + row) % 2 === 1
        ctx.fillStyle = isAlt ? palette.floorAlt : palette.floor
        ctx.fillRect(sx, sy, T, T)
        // Table surface
        ctx.fillStyle = palette.desk
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2)
        // Table edge highlight
        ctx.fillStyle = palette.wallAccent + '40'
        ctx.fillRect(sx + 1, sy + 1, T - 2, 1)
        ctx.fillRect(sx + 1, sy + 1, 1, T - 2)
        break
      }
      case TILE.VOID: {
        ctx.fillStyle = '#000000'
        ctx.fillRect(sx, sy, T, T)
        break
      }
    }
  }

  private drawRoomLabel(room: RoomDef, camera: Camera) {
    const ox = room.worldOffset.x
    const oy = room.worldOffset.y
    const roomW = room.cols * TILE_SIZE
    const centerX = ox + roomW / 2
    const labelY = oy + TILE_SIZE * 0.5

    if (!camera.isVisible(ox, oy, roomW, TILE_SIZE)) return

    const sx = Math.floor(camera.toScreenX(centerX))
    const sy = Math.floor(camera.toScreenY(labelY))

    const ctx = this.ctx
    ctx.save()
    ctx.font = '6px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = room.palette.wallAccent
    ctx.globalAlpha = 0.9
    ctx.fillText(room.label, sx, sy)
    ctx.restore()
  }

  drawAgents(entities: AgentEntity[], camera: Camera) {
    // Sort by worldY (painter's algorithm) — reuse buffer to avoid per-frame allocation
    this.sortBuffer.length = 0
    for (const e of entities) this.sortBuffer.push(e)
    this.sortBuffer.sort((a, b) => a.worldY - b.worldY)
    for (const entity of this.sortBuffer) {
      const bounds = entity.getBounds()
      if (!camera.isVisible(bounds.x, bounds.y, bounds.w, bounds.h + 8)) continue
      const frame = entity.getCurrentFrame()
      if (frame.length > 0) {
        this.drawSprite(frame, entity.worldX, entity.worldY, entity.accentColor, camera)
      }
      this.drawLabel(entity.name, entity.accentColor, entity.worldX, entity.worldY, camera)
    }
  }

  private drawSprite(
    frame: string[][],
    wx: number,
    wy: number,
    accentColor: string,
    camera: Camera
  ) {
    const sx = Math.floor(camera.toScreenX(wx))
    const sy = Math.floor(camera.toScreenY(wy))
    const ctx = this.ctx
    const cellSize = 2

    for (let row = 0; row < frame.length; row++) {
      const rowData = frame[row]
      for (let col = 0; col < rowData.length; col++) {
        const key = rowData[col]
        if (!key || key === '' || key === '.') continue

        let color: string | null
        if (key === 'B') {
          color = accentColor
        } else {
          color = COLOR_KEYS[key] ?? key
        }

        if (!color) continue
        ctx.fillStyle = color
        ctx.fillRect(sx + col * cellSize, sy + row * cellSize, cellSize, cellSize)
      }
    }
  }

  drawLabel(name: string, color: string, wx: number, wy: number, camera: Camera) {
    const sx = Math.floor(camera.toScreenX(wx + 8)) // center of 16px sprite
    const sy = Math.floor(camera.toScreenY(wy - 4)) // above sprite

    const ctx = this.ctx
    ctx.save()
    ctx.font = '5px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = color
    ctx.globalAlpha = 0.85
    // Shadow for readability
    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.6
    const tw = ctx.measureText(name).width
    ctx.fillRect(sx - tw / 2 - 1, sy - 6, tw + 2, 7)
    ctx.fillStyle = color
    ctx.globalAlpha = 1.0
    ctx.fillText(name, sx, sy)
    ctx.restore()
  }
}
