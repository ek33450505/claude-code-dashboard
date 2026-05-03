import { useQuery } from '@tanstack/react-query'

export interface AgentTruncation {
  id: number
  timestamp: string
  agent: string | null
  model: string | null
  truncated_at: string | null
}

export function useAgentTruncations() {
  return useQuery<{ truncations: AgentTruncation[] }>({
    queryKey: ['agent-truncations'],
    queryFn: async () => {
      const res = await fetch('/api/agent-truncations')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/agent-truncations`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
