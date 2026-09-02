import { makeTableRouter } from '../utils/makeTableRouter.js'

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  /** Present only when the stop hook captured a partial work log (migration 028 replaced
   *  the old has_status/has_json flags with this column). */
  partial_work_log: string | null
}

export const agentTruncationsRouter = makeTableRouter({
  table: 'agent_truncations',
  columns: 'id, session_id, agent_type, agent_id, last_line, timestamp, char_count, partial_work_log',
  orderBy: 'timestamp DESC',
  key: 'truncations',
  tag: 'agent-truncations',
  limit: { fixed: 50 },
})
