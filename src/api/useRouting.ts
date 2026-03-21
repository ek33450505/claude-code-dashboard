import { useQuery } from '@tanstack/react-query'
import type { RoutingStats } from '../types'

export function useRoutingStats() {
  return useQuery<RoutingStats>({
    queryKey: ['routing', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/routing/stats')
      if (!res.ok) throw new Error('Failed to fetch routing stats')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useRoutingTable() {
  return useQuery<{ routes: Array<{ agent: string; command: string; patternCount: number }> }>({
    queryKey: ['routing', 'table'],
    queryFn: async () => {
      const res = await fetch('/api/routing/table')
      if (!res.ok) throw new Error('Failed to fetch routing table')
      return res.json()
    },
    staleTime: 60_000,
  })
}
