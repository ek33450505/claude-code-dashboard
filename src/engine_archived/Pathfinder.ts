// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import { IMPASSABLE } from './TileIds'
import type { TileId } from './TileIds'

export interface PathNode { col: number; row: number }
export interface PathfinderGrid { tiles: TileId[]; cols: number; rows: number }

interface OpenNode extends PathNode {
  g: number
  f: number
  parent: PathNode | null
}

export class Pathfinder {
  static findPath(grid: PathfinderGrid, start: PathNode, goal: PathNode): PathNode[] {
    const { tiles, cols, rows } = grid
    const idx = (c: number, r: number) => r * cols + c
    const h = (a: PathNode, b: PathNode) => Math.abs(a.col - b.col) + Math.abs(a.row - b.row)
    const open: OpenNode[] = [{ ...start, g: 0, f: h(start, goal), parent: null }]
    const closed = new Map<number, { g: number; parent: PathNode | null }>()

    while (open.length) {
      open.sort((a, b) => a.f - b.f)
      const cur = open.shift()!
      const key = idx(cur.col, cur.row)
      if (closed.has(key)) continue
      closed.set(key, { g: cur.g, parent: cur.parent })
      if (cur.col === goal.col && cur.row === goal.row) {
        const path: PathNode[] = []
        let node: PathNode | null = goal
        while (node && !(node.col === start.col && node.row === start.row)) {
          path.unshift(node)
          const k = idx(node.col, node.row)
          node = closed.get(k)?.parent ?? null
        }
        return path
      }
      for (const [dc, dr] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nc = cur.col + dc, nr = cur.row + dr
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
        if (IMPASSABLE.has(tiles[idx(nc, nr)] as TileId)) continue
        if (closed.has(idx(nc, nr))) continue
        const g = cur.g + 1
        open.push({ col: nc, row: nr, g, f: g + h({ col: nc, row: nr }, goal), parent: cur })
      }
    }
    return []
  }

  static isReachable(grid: PathfinderGrid, start: PathNode, goal: PathNode) {
    return Pathfinder.findPath(grid, start, goal).length > 0
  }
}