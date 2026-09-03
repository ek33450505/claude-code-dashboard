import { createResourceHook } from './createResourceHook'

export interface HookFailureRow {
  id: string
  hook_name: string
  exit_code: number
  stderr: string | null
  session_id: string | null
  timestamp: string
}

const useHookFailuresResource = createResourceHook<{ failures: HookFailureRow[] }>({
  path: '/api/hook-failures',
  queryKey: ['hook-failures'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})

export function useHookFailures(since?: string) {
  return useHookFailuresResource(since != null ? { since } : undefined)
}

export const useHookFailuresCount = createResourceHook<{ count: number }>({
  path: '/api/hook-failures/count',
  queryKey: ['hook-failures', 'count'],
  staleTime: 60_000,
  refetchInterval: 60_000,
})
