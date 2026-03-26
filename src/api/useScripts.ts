import { useQuery } from '@tanstack/react-query'
import type { ScriptFile } from '../types'
import { apiFetch } from './apiFetch'

export function useScripts() {
  return useQuery<ScriptFile[]>({
    queryKey: ['scripts'],
    queryFn: () => apiFetch<ScriptFile[]>('/api/scripts'),
    staleTime: 60_000,
  })
}

export function useScriptContent(name: string) {
  return useQuery<{ name: string; body: string }>({
    queryKey: ['scripts', name],
    queryFn: () => apiFetch(`/api/scripts/${encodeURIComponent(name)}`),
    enabled: !!name,
    staleTime: 60_000,
  })
}
