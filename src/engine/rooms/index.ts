import { CoreOpsRoom } from './CoreOps'
import { ExtendedRoom } from './Extended'
import { ProductivityRoom } from './Productivity'
import { ProfessionalRoom } from './Professional'
import { OrchestrationRoom } from './Orchestration'
import { FieldOpsRoom } from './FieldOps'
import type { RoomDef } from './types'

export const ROOMS: RoomDef[] = [
  CoreOpsRoom,
  ExtendedRoom,
  ProductivityRoom,
  ProfessionalRoom,
  OrchestrationRoom,
  FieldOpsRoom,
]

export const WORLD_WIDTH_PX = 1760 + 320  // 2080
export const WORLD_HEIGHT_PX = 14 * 16    // 224

export function getRoomForAgent(agentName: string): RoomDef | undefined {
  return ROOMS.find(r => r.agents.includes(agentName))
}
