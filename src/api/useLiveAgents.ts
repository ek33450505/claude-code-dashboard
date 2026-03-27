import { useQuery } from '@tanstack/react-query'
import type { LiveAgent } from '../types'
import { apiFetch } from './apiFetch'

export function useLiveAgents() {
  return useQuery<LiveAgent[]>({
    queryKey: ['agents', 'live'],
    queryFn: () => apiFetch<LiveAgent[]>('/api/agents/live'),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  })
}
