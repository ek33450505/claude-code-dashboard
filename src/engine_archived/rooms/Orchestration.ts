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
const BS = TILE.BOOKSHELF
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// 20 cols × 14 rows — Control room
// BOOKSHELF row at top as "pipeline dashboard display panels"
const grid: TileId[][] = [
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
  [WV, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, BS, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, SR,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV, SR,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, SR,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, SR, WV],
  [WC, DO, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, DO, WC],
]

const tiles: TileId[] = grid.flat()

export const OrchestrationRoom: RoomDef = {
  id: 'orchestration',
  label: 'ORCHESTRATION',
  agents: ['orchestrator', 'auto-stager', 'chain-reporter', 'verifier'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'orchestrator':  { col: 3,  row: 3  },
    'auto-stager':   { col: 17, row: 3  },
    'chain-reporter':{ col: 3,  row: 10 },
    'verifier':      { col: 17, row: 10 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 1408, y: 0 },
  doors: [
    { tile: { col: 1,  row: 13 }, leadsTo: 'professional' },
    { tile: { col: 18, row: 13 }, leadsTo: 'field-ops' },
  ],
  palette: {
    floor: '#0d0d1a',
    floorAlt: '#0f0f1e',
    wall: '#1a0d3a',
    wallAccent: '#a78bfa',
    desk: '#180d30',
    monitor: '#a78bfa',
    gather: '#a78bfa15',
    doorFrame: '#a78bfa50',
  },
}