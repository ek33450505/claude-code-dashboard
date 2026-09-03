import { createResourceHook } from './createResourceHook'

export interface AgentTruncation {
  id: number
  session_id: string | null
  agent_type: string
  agent_id: string | null
  last_line: string | null
  timestamp: string
  char_count: number | null
  partial_work_log: string | null
}

export const useAgentTruncations = createResourceHook<{ truncations: AgentTruncation[] }>({
  path: '/api/agent-truncations',
  queryKey: ['agent-truncations'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})
