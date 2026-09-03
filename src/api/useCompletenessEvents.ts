import { createResourceHook } from './createResourceHook'

export interface CompletenessEvent {
  id: number
  agent: string
  truncated_at: string
  snippet: string | null
  severity: string
  created_at: string
}

const useCompletenessEventsResource = createResourceHook<{
  entries: CompletenessEvent[]
  total: number
}>({
  path: '/api/completeness-events',
  queryKey: ['completeness-events'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})

export function useCompletenessEvents(params?: { limit?: number; offset?: number }) {
  return useCompletenessEventsResource(params)
}

export const useCompletenessEventsStats = createResourceHook<{ bySeverity: Record<string, number> }>({
  path: '/api/completeness-events/stats',
  queryKey: ['completeness-events', 'stats'],
  staleTime: 30_000,
  refetchInterval: 60_000,
})
