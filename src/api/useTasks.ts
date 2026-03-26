import { useQuery } from '@tanstack/react-query'
import type { TaskEntry } from '../types'
import { apiFetch } from './apiFetch'

export function useTasks() {
  return useQuery<TaskEntry[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch<TaskEntry[]>('/api/tasks'),
    staleTime: 60_000,
  })
}
