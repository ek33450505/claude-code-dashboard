// ARCHIVED: Phase 8.5 — unused game engine, kept for potential future Easter egg mode
import { CastHQRoom } from './CastHQ'
import type { RoomDef } from './types'

export const ROOMS: RoomDef[] = [CastHQRoom]

export const WORLD_WIDTH_PX = CastHQRoom.cols * 16
export const WORLD_HEIGHT_PX = CastHQRoom.rows * 16

export function getRoomForAgent(agentName: string): RoomDef | undefined {
  return ROOMS.find(r => r.agents.includes(agentName))
}