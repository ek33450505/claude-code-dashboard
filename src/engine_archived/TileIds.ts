// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
export const TILE = {
  FLOOR: 0, WALL_H: 1, WALL_V: 2, WALL_CORNER: 3, DOOR: 4, WINDOW: 5,
  DESK: 10, MONITOR: 11, BOOKSHELF: 12, SERVER_RACK: 13, PLANT: 14,
  COFFEE: 15, WHITEBOARD: 16, MEETING_TBL: 17,
  SPAWN: 20, GATHER: 21, VOID: 255,
} as const

export type TileId = typeof TILE[keyof typeof TILE]

export const IMPASSABLE = new Set<TileId>([
  TILE.WALL_H, TILE.WALL_V, TILE.WALL_CORNER, TILE.WINDOW,
  TILE.DESK, TILE.MONITOR, TILE.BOOKSHELF, TILE.SERVER_RACK,
  TILE.PLANT, TILE.MEETING_TBL, TILE.VOID,
])