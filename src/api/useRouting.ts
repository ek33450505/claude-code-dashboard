import { createResourceHook } from './createResourceHook'
import type { DispatchEvent } from '../types'

// Shape returned by GET /api/routing/stats (aggregates over agent_runs).
export interface DispatchStats {
  total: number
  /** Run count keyed by status (DONE, BLOCKED, running, …). */
  byStatus: Record<string, number>
  topAgent: string | null
  last24hCount: number
}

export const useDispatchEvents = createResourceHook<DispatchEvent[]>({
  path: '/api/routing/events',
  queryKey: ['routing', 'events'],
  refetchInterval: 60_000,
  staleTime: 15_000,
})

export const useRoutingStats = createResourceHook<DispatchStats>({
  path: '/api/routing/stats',
  queryKey: ['routing', 'stats'],
  refetchInterval: 60_000,
  staleTime: 15_000,
})
