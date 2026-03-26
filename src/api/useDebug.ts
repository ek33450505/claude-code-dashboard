import { useQuery } from '@tanstack/react-query'
import type { DebugLogFile } from '../types'
import { apiFetch } from './apiFetch'

export function useDebugLogs() {
  return useQuery<DebugLogFile[]>({
    queryKey: ['debug'],
    queryFn: () => apiFetch<DebugLogFile[]>('/api/debug'),
    staleTime: 60_000,
  })
}

export function useDebugLog(id: string) {
  return useQuery<{ id: string; body: string; lineCount: number; truncated: boolean }>({
    queryKey: ['debug', id],
    queryFn: () => apiFetch(`/api/debug/${encodeURIComponent(id)}`),
    enabled: !!id,
    staleTime: 60_000,
  })
}
