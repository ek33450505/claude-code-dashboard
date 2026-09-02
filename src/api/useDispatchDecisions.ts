import { useQuery } from '@tanstack/react-query'
import type { DispatchDecision } from '../types'

export type { DispatchDecision }

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
