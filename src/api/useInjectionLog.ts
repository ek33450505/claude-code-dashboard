import { useQuery } from '@tanstack/react-query'

export interface InjectionLogEntry {
  id: number
  timestamp: string
  hook_type: string | null
  content_preview: string | null
}

export function useInjectionLog() {
  return useQuery<{ entries: InjectionLogEntry[] }>({
    queryKey: ['injection-log'],
    queryFn: async () => {
      const res = await fetch('/api/injection-log')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/injection-log`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
