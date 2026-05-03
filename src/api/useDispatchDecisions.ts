import { useQuery } from '@tanstack/react-query'

export interface DispatchDecision {
  id: number
  session_id: string | null
  prompt_snippet: string | null
  chosen_agent: string | null
  model: string | null
  effort: string | null
  wave_id: string | null
  parallel: number | null
  created_at: string
}

export function useDispatchDecisions() {
  return useQuery<{ decisions: DispatchDecision[] }>({
    queryKey: ['dispatch-decisions'],
    queryFn: async () => {
      const res = await fetch('/api/dispatch-decisions')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/dispatch-decisions`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
