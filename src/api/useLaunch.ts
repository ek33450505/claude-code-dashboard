import { useQuery } from '@tanstack/react-query'
import type { LaunchConfig } from '../types'

export function useLaunchConfigs() {
  return useQuery<{ configurations: LaunchConfig[] }>({
    queryKey: ['launch'],
    queryFn: async () => {
      const res = await fetch('/api/launch')
      if (!res.ok) throw new Error('Failed to fetch launch configs')
      return res.json()
    },
    staleTime: 60_000,
  })
}
