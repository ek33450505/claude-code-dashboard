import { createResourceHook } from './createResourceHook'

export interface RoutingEvent {
  id: number
  session_id: string
  timestamp: string
  event_type: string
  agent: string | null
  data: string | null
  project: string | null
}

// Namespaced under ['routing', ...] (not ['routing-events', ...]) so that
// useDbChangeInvalidation's `invalidateQueries({ queryKey: ['routing'] })`
// prefix-match reaches this query on db_change_routing_event too.
export const useRoutingEventsByType = createResourceHook<RoutingEvent[]>({
  path: '/api/routing/events',
  queryKey: ['routing', 'events-by-type'],
  refetchInterval: 10_000,
  staleTime: 5_000,
})
