// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import { TILE } from '../TileIds'
import type { TileId } from '../TileIds'
import type { RoomDef } from './types'

// Aliases for readability
const F = TILE.FLOOR        // 0
const WH = TILE.WALL_H      // 1
const WV = TILE.WALL_V      // 2
const WC = TILE.WALL_CORNER // 3
const DO = TILE.DOOR        // 4
const D = TILE.DESK         // 10
const SR = TILE.SERVER_RACK // 13
const MT = TILE.MEETING_TBL // 17
const SP = TILE.SPAWN       // 20
const GT = TILE.GATHER      // 21

// 20 cols × 14 rows — Dark command center
// Row indices 0–13, Col indices 0–19
const grid: TileId[][] = [
  //0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC], // row 0
  [WV, SR,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, SR, WV], // row 1
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 2
  [WV,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, WV], // row 3
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 4
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 5
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV], // row 6
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV], // row 7
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 8
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 9
  [WV,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, WV], // row 10
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV], // row 11
  [WV, SR,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, SR, WV], // row 12
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, DO, WH, WH, WH, WH, WH, WH, WH, WH, WC], // row 13
]

const tiles: TileId[] = grid.flat()

export const CoreOpsRoom: RoomDef = {
  id: 'core-ops',
  label: 'CORE OPS',
  agents: ['planner', 'debugger', 'test-writer', 'code-reviewer', 'data-scientist', 'db-reader', 'commit', 'security'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'planner':        { col: 4,  row: 1  },
    'debugger':       { col: 16, row: 1  },
    'test-writer':    { col: 3,  row: 3  },
    'code-reviewer':  { col: 17, row: 3  },
    'data-scientist': { col: 3,  row: 10 },
    'db-reader':      { col: 17, row: 10 },
    'commit':         { col: 4,  row: 12 },
    'security':       { col: 16, row: 12 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 0, y: 0 },
  doors: [{ tile: { col: 10, row: 13 }, leadsTo: 'extended' }],
  palette: {
    floor: '#0d1117',
    floorAlt: '#0f1419',
    wall: '#0f3460',
    wallAccent: '#00ffc2',
    desk: '#1a2634',
    monitor: '#00ffc2',
    gather: '#00ffc215',
    doorFrame: '#00ffc250',
  },
}