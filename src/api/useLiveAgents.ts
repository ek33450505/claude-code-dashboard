import { useQuery } from '@tanstack/react-query'
import type { LiveAgent } from '../types'

export function useLiveAgents() {
  return useQuery<LiveAgent[]>({
    queryKey: ['agents', 'live'],
    queryFn: async () => {
      const res = await fetch('/api/agents/live')
      if (!res.ok) throw new Error('Failed to fetch live agents')
      return res.json()
    },
    refetchInterval: 10_000,
    staleTime: 8_000,
  })
}
