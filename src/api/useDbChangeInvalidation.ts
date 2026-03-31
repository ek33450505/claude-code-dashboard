import { useQueryClient } from '@tanstack/react-query'
import { useLiveEvents } from './useLive'
import type { LiveEvent } from '../types'

/**
 * Listens to SSE db_change_* events and invalidates the matching React Query
 * cache keys so all subscribers refetch immediately without polling.
 */
export function useDbChangeInvalidation() {
  const queryClient = useQueryClient()

  const handleEvent = (event: LiveEvent) => {
    switch (event.type) {
      case 'db_change_agent_run':
        queryClient.invalidateQueries({ queryKey: ['cast', 'agent-runs'] })
        break
      case 'db_change_session':
        queryClient.invalidateQueries({ queryKey: ['sessions'] })
        break
      case 'db_change_routing_event':
        queryClient.invalidateQueries({ queryKey: ['routing'] })
        break
    }
  }

  // useLiveEvents accepts an onEvent callback — share the single SSE connection
  useLiveEvents(handleEvent)
}
