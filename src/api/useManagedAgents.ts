import { useQuery } from '@tanstack/react-query'

export interface ManagedAgentInvocation {
  id: string
  ts: string
  agent_name: string
  mode: string | null
  http_status: number | null
  exit_code: number | null
  session_duration_ms: number | null
}

export function useManagedAgents() {
  return useQuery<{ invocations: ManagedAgentInvocation[] }>({
    queryKey: ['managed-agents'],
    queryFn: async () => {
      const res = await fetch('/api/managed-agents')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/managed-agents`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
