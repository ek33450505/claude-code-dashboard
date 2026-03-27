// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import type { TileId } from '../TileIds'

export interface WorldPos { x: number; y: number }
export interface TileCoord { col: number; row: number }

export interface RoomPalette {
  floor: string; floorAlt: string; wall: string; wallAccent: string;
  desk: string; monitor: string; gather: string; doorFrame: string;
}

export interface RoomDef {
  id: string
  label: string
  agents: readonly string[]
  cols: number
  rows: number
  tiles: TileId[]
  spawnPoints: Record<string, TileCoord>
  gatherPoint: TileCoord
  worldOffset: WorldPos
  doors: Array<{ tile: TileCoord; leadsTo: string }>
  palette: RoomPalette
}