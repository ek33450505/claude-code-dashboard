import { useQuery } from '@tanstack/react-query'

export interface ParryGuardEvent {
  id: number
  timestamp: string
  event_type: string
  agent: string | null
  detail: string | null
}

export function useParryGuard() {
  return useQuery<{ events: ParryGuardEvent[] }>({
    queryKey: ['parry-guard'],
    queryFn: async () => {
      const res = await fetch('/api/parry-guard')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/parry-guard`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
