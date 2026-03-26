import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../types'
import { apiFetch } from './apiFetch'

export function useHookDefinitions() {
  return useQuery<HookDefinition[]>({
    queryKey: ['hooks'],
    queryFn: () => apiFetch<HookDefinition[]>('/api/hooks'),
    staleTime: 60_000,
  })
}
