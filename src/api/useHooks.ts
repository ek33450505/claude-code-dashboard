import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../types'

export function useHookDefinitions() {
  return useQuery<HookDefinition[]>({
    queryKey: ['hooks'],
    queryFn: async () => {
      const res = await fetch('/api/hooks')
      if (!res.ok) throw new Error('Failed to fetch hooks')
      return res.json()
    },
    staleTime: 60_000,
  })
}
