import { useQuery } from '@tanstack/react-query'
import type { DebugLogFile } from '../types'

export function useDebugLogs() {
  return useQuery<DebugLogFile[]>({
    queryKey: ['debug'],
    queryFn: async () => {
      const res = await fetch('/api/debug')
      if (!res.ok) throw new Error('Failed to fetch debug logs')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useDebugLog(id: string) {
  return useQuery<{ id: string; body: string; lineCount: number; truncated: boolean }>({
    queryKey: ['debug', id],
    queryFn: async () => {
      const res = await fetch(`/api/debug/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error('Failed to fetch debug log')
      return res.json()
    },
    enabled: !!id,
    staleTime: 60_000,
  })
}
