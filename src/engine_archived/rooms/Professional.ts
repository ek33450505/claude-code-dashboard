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
const WN = TILE.WINDOW
const WB = TILE.WHITEBOARD
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// 20 cols × 14 rows — Modern upscale office
const grid: TileId[][] = [
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, WN, WN, WN, WN,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WN, WN, WN, WN, WV],
  [WV,  F,  F,  F,  F,  F,  D, SP,  F,  F,  F,  F,  D, SP,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WB, WV],
  [WC, DO, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, DO, WC],
]

const tiles: TileId[] = grid.flat()

export const ProfessionalRoom: RoomDef = {
  id: 'professional',
  label: 'PROFESSIONAL',
  agents: ['browser', 'qa-reviewer', 'presenter'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'browser':     { col: 7,  row: 3 },
    'qa-reviewer': { col: 13, row: 3 },
    'presenter':   { col: 7,  row: 10 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 1056, y: 0 },
  doors: [
    { tile: { col: 1,  row: 13 }, leadsTo: 'productivity' },
    { tile: { col: 18, row: 13 }, leadsTo: 'orchestration' },
  ],
  palette: {
    floor: '#111827',
    floorAlt: '#141e2e',
    wall: '#1e293b',
    wallAccent: '#818cf8',
    desk: '#1e2438',
    monitor: '#818cf8',
    gather: '#818cf815',
    doorFrame: '#818cf850',
  },
}