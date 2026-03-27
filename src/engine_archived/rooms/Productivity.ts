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
const PL = TILE.PLANT
const CO = TILE.COFFEE
const WB = TILE.WHITEBOARD
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// 20 cols × 14 rows — Bright open office
const grid: TileId[][] = [
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
  [WV, PL,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, PL, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  D, SP,  F,  F, WB, WB, WB, WB, WB, WB, WB, WB,  F,  F,  D, SP,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, PL,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, PL, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, PL,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, PL, WV],
  [WV,  F,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, CO, CO,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, PL, WV],
  [WC, DO, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, DO, WC],
]

const tiles: TileId[] = grid.flat()

export const ProductivityRoom: RoomDef = {
  id: 'productivity',
  label: 'PRODUCTIVITY',
  agents: ['researcher', 'report-writer', 'meeting-notes', 'email-manager', 'morning-briefing'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'researcher':       { col: 4,  row: 1  },
    'report-writer':    { col: 3,  row: 3  },
    'meeting-notes':    { col: 17, row: 3  },
    'email-manager':    { col: 4,  row: 10 },
    'morning-briefing': { col: 16, row: 12 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 704, y: 0 },
  doors: [
    { tile: { col: 1,  row: 13 }, leadsTo: 'extended' },
    { tile: { col: 18, row: 13 }, leadsTo: 'professional' },
  ],
  palette: {
    floor: '#1a1f1a',
    floorAlt: '#1e231e',
    wall: '#1e3a1e',
    wallAccent: '#86efac',
    desk: '#1e2e1e',
    monitor: '#86efac',
    gather: '#86efac15',
    doorFrame: '#86efac50',
  },
}