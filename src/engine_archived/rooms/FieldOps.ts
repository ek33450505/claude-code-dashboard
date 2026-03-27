// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import { TILE } from '../TileIds'
import type { TileId } from '../TileIds'
import type { RoomDef } from './types'

const F = TILE.FLOOR
const WH = TILE.WALL_H
const WV = TILE.WALL_V
const WC = TILE.WALL_CORNER
const DO = TILE.DOOR
const D = TILE.DESK
const SR = TILE.SERVER_RACK
const WB = TILE.WHITEBOARD
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// 20 cols × 14 rows — Tactical explorer (asymmetric, more open)
const grid: TileId[][] = [
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F, SR, SR,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F, SR, SR,  F,  F,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, SR,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, SR,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, WB, WB, WB, WB, WB, WB,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, D,  SP,  F,  F, WV],
  [WV,  F,  F, D,  SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, SR, WV],
  [WC, DO, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
]

const tiles: TileId[] = grid.flat()

export const FieldOpsRoom: RoomDef = {
  id: 'field-ops',
  label: 'FIELD OPS',
  agents: ['explore', 'plan', 'general-purpose'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'explore':         { col: 8,  row: 3  },
    'plan':            { col: 4,  row: 11 },
    'general-purpose': { col: 16, row: 10 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 1760, y: 0 },
  doors: [{ tile: { col: 1, row: 13 }, leadsTo: 'orchestration' }],
  palette: {
    floor: '#1a170d',
    floorAlt: '#1e1a10',
    wall: '#2d2010',
    wallAccent: '#f87171',
    desk: '#2a1a10',
    monitor: '#f87171',
    gather: '#f8717115',
    doorFrame: '#f8717150',
  },
}