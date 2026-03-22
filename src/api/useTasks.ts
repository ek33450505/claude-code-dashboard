import { useQuery } from '@tanstack/react-query'
import type { TaskEntry } from '../types'

export function useTasks() {
  return useQuery<TaskEntry[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch tasks')
      return res.json()
    },
    staleTime: 60_000,
  })
}
