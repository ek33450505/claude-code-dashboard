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
const BS = TILE.BOOKSHELF
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// 20 cols × 14 rows — Builder's workshop
const grid: TileId[][] = [
  [WC, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WC],
  [WV, BS,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, BS, WV],
  [WV, BS,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, BS, WV],
  [WV, BS,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, BS, WV],
  [WV, BS,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, BS, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F, MT, MT, GT, GT, MT, MT,  F,  F,  F,  F,  F,  F, WV],
  [WV,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, WV],
  [WV, BS,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, BS, WV],
  [WV, BS,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, BS, WV],
  [WV, BS,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F, BS, WV],
  [WV, BS,  F,  D, SP,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  D, SP,  F, BS, WV],
  [WC, DO, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, WH, DO, WC],
]

const tiles: TileId[] = grid.flat()

export const ExtendedRoom: RoomDef = {
  id: 'extended',
  label: 'EXTENDED',
  agents: ['architect', 'tdd-guide', 'build-error-resolver', 'e2e-runner', 'refactor-cleaner', 'doc-updater', 'readme-writer', 'router'],
  cols: 20,
  rows: 14,
  tiles,
  spawnPoints: {
    'architect':            { col: 4,  row: 1  },
    'tdd-guide':            { col: 16, row: 1  },
    'build-error-resolver': { col: 4,  row: 3  },
    'e2e-runner':           { col: 16, row: 3  },
    'refactor-cleaner':     { col: 4,  row: 10 },
    'doc-updater':          { col: 16, row: 10 },
    'readme-writer':        { col: 4,  row: 12 },
    'router':               { col: 16, row: 12 },
  },
  gatherPoint: { col: 9, row: 6 },
  worldOffset: { x: 352, y: 0 },
  doors: [
    { tile: { col: 1,  row: 13 }, leadsTo: 'core-ops' },
    { tile: { col: 18, row: 13 }, leadsTo: 'productivity' },
  ],
  palette: {
    floor: '#1a1a0d',
    floorAlt: '#1e1e10',
    wall: '#3a2d1a',
    wallAccent: '#fbbf24',
    desk: '#2d2010',
    monitor: '#fbbf24',
    gather: '#fbbf2415',
    doorFrame: '#fbbf2450',
  },
}