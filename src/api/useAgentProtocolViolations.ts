import { createResourceHook } from './createResourceHook'

export interface AgentProtocolViolation {
  id: number
  session_id: string | null
  agent_type: string | null
  agent_id: string | null
  batch_id: string | null
  violation: string | null
  pattern: string | null
  timestamp: string
  raw_excerpt: string | null
}

export const useAgentProtocolViolations = createResourceHook<{ data: AgentProtocolViolation[] }>({
  path: '/api/agent-protocol-violations',
  queryKey: ['agent-protocol-violations'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})
