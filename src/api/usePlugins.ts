import { useQuery } from '@tanstack/react-query'
import type { PluginEntry } from '../types'

export function usePlugins() {
  return useQuery<PluginEntry[]>({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await fetch('/api/plugins')
      if (!res.ok) throw new Error('Failed to fetch plugins')
      return res.json()
    },
    staleTime: 60_000,
  })
}
