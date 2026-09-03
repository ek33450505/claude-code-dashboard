import { createResourceHook } from './createResourceHook'

export interface HallucinationRow {
  id: number
  session_id: string | null
  agent_name: string
  claim_type: string
  claimed_value: string | null
  actual_value: string | null
  verified: number
  timestamp: string
}

export interface HallucinationStats {
  total: number
  by_agent: Array<{ agent_name: string; count: number }>
  by_type: Array<{ claim_type: string; count: number }>
}

const useAgentHallucinationsResource = createResourceHook<{ entries: HallucinationRow[] }>({
  path: '/api/agent-hallucinations',
  queryKey: ['agent-hallucinations'],
  staleTime: 30_000,
})

export function useAgentHallucinations(agent?: string, since?: string) {
  return useAgentHallucinationsResource(
    agent != null || since != null ? { agent, since } : undefined
  )
}

export const useAgentHallucinationStats = createResourceHook<HallucinationStats>({
  path: '/api/agent-hallucinations/stats',
  queryKey: ['agent-hallucinations', 'stats'],
  staleTime: 60_000,
})
