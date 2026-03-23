import { TILE } from '../TileIds'
import type { TileId } from '../TileIds'
import type { RoomDef } from './types'

// Aliases
const F = TILE.FLOOR
const WH = TILE.WALL_H
const WV = TILE.WALL_V
const WC = TILE.WALL_CORNER
const WN = TILE.WINDOW
const D = TILE.DESK
const M = TILE.MONITOR
const BS = TILE.BOOKSHELF
const SR = TILE.SERVER_RACK
const PL = TILE.PLANT
const CF = TILE.COFFEE
const WB = TILE.WHITEBOARD
const MT = TILE.MEETING_TBL
const SP = TILE.SPAWN
const GT = TILE.GATHER

// ──────────────────────────────────────────────────────────────
// CAST HQ — 40 cols × 28 rows
//
// Layout:
//   ┌───────────────────┬───────────────────┐
//   │   CORE OPS (8)    │   EXTENDED (8)    │  rows 1-8
//   │   server racks    │   bookshelves     │
//   ├────────┐          │          ┌────────┤
//   │        └──── MEETING ────┘          │  rows 9-12
//   │        ┌── AREA (gather) ──┐        │
//   ├────────┘          │          └────────┤
//   │ PRODUCTIVITY (5)  │  PROFESSIONAL (3) │  rows 13-19
//   │   plants/coffee   │   windows         │
//   ├───────────────────┼───────────────────┤
//   │ ORCHESTRATION (4) │  FIELD OPS (3)    │  rows 20-27
//   │   dashboards      │   break room      │
//   └───────────────────┴───────────────────┘
// ──────────────────────────────────────────────────────────────

function buildGrid(): TileId[][] {
  const C = 40, R = 28
  const g: TileId[][] = []

  for (let r = 0; r < R; r++) {
    const row: TileId[] = []
    for (let c = 0; c < C; c++) {
      // Outer walls
      if (r === 0 || r === R - 1) {
        if (c === 0 || c === C - 1) row.push(WC)
        else row.push(WH)
      } else if (c === 0 || c === C - 1) {
        row.push(WV)
      } else {
        row.push(F)
      }
    }
    g.push(row)
  }

  // Helper to place tiles
  const set = (r: number, c: number, t: TileId) => { g[r][c] = t }
  const hWall = (r: number, c1: number, c2: number) => {
    for (let c = c1; c <= c2; c++) set(r, c, WH)
  }

  // ── Center divider (vertical, partial) ──
  // Rows 1-8: partial wall between Core Ops and Extended
  for (let r = 1; r <= 8; r++) set(r, 20, WV)
  // Rows 13-19: partial wall between Productivity and Professional
  for (let r = 13; r <= 19; r++) set(r, 20, WV)
  // Rows 20-27: partial wall between Orchestration and Field Ops
  for (let r = 20; r <= 26; r++) set(r, 20, WV)

  // ── Horizontal dividers ──
  // Between top zone and meeting area (row 9, partial)
  hWall(9, 1, 8); set(9, 0, WC)
  hWall(9, 31, 38); set(9, 39, WC)

  // Between meeting area and mid zone (row 13, partial)
  hWall(13, 1, 8); set(13, 0, WC)
  hWall(13, 31, 38); set(13, 39, WC)
  set(13, 20, WC) // center junction

  // Between mid zone and bottom zone (row 20)
  hWall(20, 1, 19); set(20, 0, WC); set(20, 20, WC)
  hWall(20, 21, 38); set(20, 39, WC)
  // Doorways in row 20
  set(20, 10, F); set(20, 30, F)

  // ── Windows ──
  set(0, 5, WN); set(0, 10, WN); set(0, 15, WN)
  set(0, 25, WN); set(0, 30, WN); set(0, 35, WN)
  for (let r = 14; r <= 18; r += 2) set(r, 39, WN) // Professional windows

  // ── CORE OPS zone (rows 1-8, cols 1-19) — server racks & desks ──
  set(1, 1, SR); set(1, 2, SR)
  set(2, 1, SR); set(2, 2, SR)
  // Desks along top
  set(2, 5, D); set(2, 6, M)
  set(2, 9, D); set(2, 10, M)
  set(2, 13, D); set(2, 14, M)
  set(2, 17, D); set(2, 18, M)
  // Lower desks
  set(6, 3, D); set(6, 4, M)
  set(6, 8, D); set(6, 9, M)
  set(6, 14, D); set(6, 15, M)
  set(6, 17, D); set(6, 18, M)

  // ── EXTENDED zone (rows 1-8, cols 21-38) — bookshelves & workshop ──
  set(1, 21, BS); set(1, 22, BS); set(1, 23, BS)
  set(1, 36, BS); set(1, 37, BS); set(1, 38, BS)
  // Desks
  set(2, 24, D); set(2, 25, M)
  set(2, 28, D); set(2, 29, M)
  set(2, 32, D); set(2, 33, M)
  set(2, 36, D); set(2, 37, M)
  set(6, 22, D); set(6, 23, M)
  set(6, 27, D); set(6, 28, M)
  set(6, 33, D); set(6, 34, M)
  set(6, 37, D); set(6, 38, M)

  // ── CENTRAL MEETING AREA (rows 10-12, cols 9-31) ──
  // Big meeting table
  for (let c = 15; c <= 24; c++) { set(10, c, MT); set(11, c, MT) }
  set(10, 19, GT); set(10, 20, GT); set(11, 19, GT); set(11, 20, GT)
  // Whiteboard
  set(9, 19, WB); set(9, 20, WB)

  // ── PRODUCTIVITY zone (rows 14-19, cols 1-19) — plants & coffee ──
  set(14, 1, PL); set(14, 19, PL)
  set(15, 5, CF); set(15, 15, CF) // coffee on desks
  set(19, 19, PL)
  // Desks
  set(15, 3, D); set(15, 4, M)
  set(15, 8, D); set(15, 9, M)
  set(15, 14, D); set(15, 15, M)
  set(18, 5, D); set(18, 6, M)
  set(18, 12, D); set(18, 13, M)
  // Whiteboard
  set(14, 10, WB); set(14, 11, WB)

  // ── PROFESSIONAL zone (rows 14-19, cols 21-38) — upscale ──
  set(14, 21, PL); set(14, 38, PL)
  // Desks
  set(15, 24, D); set(15, 25, M)
  set(15, 30, D); set(15, 31, M)
  set(15, 35, D); set(15, 36, M)
  // Whiteboard
  set(14, 29, WB); set(14, 30, WB)

  // ── ORCHESTRATION zone (rows 21-26, cols 1-19) — control room ──
  set(21, 1, BS); set(21, 2, BS); set(21, 3, BS); set(21, 4, BS)
  set(21, 15, BS); set(21, 16, BS); set(21, 17, BS); set(21, 18, BS)
  // Desks
  set(23, 3, D); set(23, 4, M)
  set(23, 9, D); set(23, 10, M)
  set(23, 14, D); set(23, 15, M)
  set(25, 6, D); set(25, 7, M)

  // ── FIELD OPS zone (rows 21-26, cols 21-38) — break room ──
  set(22, 32, CF); set(22, 36, CF) // coffee on desks
  set(22, 38, PL)
  // Couches (meeting tables as couches)
  set(23, 25, MT); set(23, 26, MT)
  set(24, 25, MT); set(24, 26, MT)
  // Desks
  set(22, 30, D); set(22, 31, M)
  set(22, 34, D); set(22, 35, M)
  set(25, 30, D); set(25, 31, M)

  return g
}

const grid = buildGrid()
const tiles: TileId[] = grid.flat()

export const CastHQRoom: RoomDef = {
  id: 'cast-hq',
  label: 'CAST HQ',
  agents: [
    // Core Ops
    'planner', 'debugger', 'test-writer', 'code-reviewer',
    'data-scientist', 'db-reader', 'commit', 'security',
    // Extended
    'architect', 'tdd-guide', 'build-error-resolver', 'e2e-runner',
    'refactor-cleaner', 'doc-updater', 'readme-writer', 'router',
    // Productivity
    'researcher', 'report-writer', 'meeting-notes', 'email-manager',
    'morning-briefing',
    // Professional
    'browser', 'qa-reviewer', 'presenter',
    // Orchestration
    'orchestrator', 'auto-stager', 'chain-reporter', 'verifier',
    // Field Ops
    'explore', 'plan', 'general-purpose',
  ],
  cols: 40,
  rows: 28,
  tiles,
  spawnPoints: {
    // Core Ops — ON desk tiles (row,col matches D tiles)
    'planner':        { col: 5,  row: 2 },  // desk at (2,5)
    'debugger':       { col: 9,  row: 2 },  // desk at (2,9)
    'test-writer':    { col: 13, row: 2 },  // desk at (2,13)
    'code-reviewer':  { col: 17, row: 2 },  // desk at (2,17)
    'data-scientist': { col: 3,  row: 6 },  // desk at (6,3)
    'db-reader':      { col: 8,  row: 6 },  // desk at (6,8)
    'commit':         { col: 14, row: 6 },  // desk at (6,14)
    'security':       { col: 17, row: 6 },  // desk at (6,17)
    // Extended — ON desk tiles
    'architect':           { col: 24, row: 2 },  // desk at (2,24)
    'tdd-guide':           { col: 28, row: 2 },  // desk at (2,28)
    'build-error-resolver':{ col: 32, row: 2 },  // desk at (2,32)
    'e2e-runner':          { col: 36, row: 2 },  // desk at (2,36)
    'refactor-cleaner':    { col: 22, row: 6 },  // desk at (6,22)
    'doc-updater':         { col: 27, row: 6 },  // desk at (6,27)
    'readme-writer':       { col: 33, row: 6 },  // desk at (6,33)
    'router':              { col: 37, row: 6 },  // desk at (6,37)
    // Productivity — ON desk tiles
    'researcher':      { col: 3,  row: 15 },  // desk at (15,3)
    'report-writer':   { col: 8,  row: 15 },  // desk at (15,8)
    'meeting-notes':   { col: 14, row: 15 },  // desk at (15,14)
    'email-manager':   { col: 5,  row: 18 },  // desk at (18,5)
    'morning-briefing':{ col: 12, row: 18 },  // desk at (18,12)
    // Professional — ON desk tiles
    'browser':      { col: 24, row: 15 },  // desk at (15,24)
    'qa-reviewer':  { col: 30, row: 15 },  // desk at (15,30)
    'presenter':    { col: 35, row: 15 },  // desk at (15,35)
    // Orchestration — ON desk tiles
    'orchestrator':  { col: 3,  row: 23 },  // desk at (23,3)
    'auto-stager':   { col: 9,  row: 23 },  // desk at (23,9)
    'chain-reporter':{ col: 14, row: 23 },  // desk at (23,14)
    'verifier':      { col: 6,  row: 25 },  // desk at (25,6)
    // Field Ops — ON desk tiles
    'explore':         { col: 30, row: 22 },  // desk at (22,30)
    'plan':            { col: 34, row: 22 },  // desk at (22,34)
    'general-purpose': { col: 30, row: 25 },  // desk at (25,30)
  },
  gatherPoint: { col: 19, row: 11 },
  worldOffset: { x: 0, y: 0 },
  doors: [],
  palette: {
    floor: '#0d1117',
    floorAlt: '#0f1419',
    wall: '#1a2744',
    wallAccent: '#00ffc2',
    desk: '#1a2634',
    monitor: '#00ffc2',
    gather: '#00ffc215',
    doorFrame: '#00ffc250',
  },
}
