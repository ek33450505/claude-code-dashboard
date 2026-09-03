import type { CompactionEvent } from '../types'
import { createResourceHook } from './createResourceHook'

export type { CompactionEvent }

interface CompactionEventsResponse {
  events: CompactionEvent[]
}

/**
 * D11: previously two separate hooks (this file and useCastData.ts) fetched
 * the same `/api/cast/compaction-events` endpoint under different queryKeys,
 * so React Query cached and fetched them independently. Collapsed to one
 * hook here, AND both call sites (CompactionTimeline.tsx and
 * AnalyticsView.tsx's CompactionTab) now pass the identical `{ limit: 200 }`
 * param, which is what actually makes them share one queryKey/cache entry —
 * unifying the hook definition alone was not sufficient. Caching policy:
 * kept the more conservative 15s staleTime / 30s refetchInterval (the
 * AnalyticsView.tsx consumer's prior policy) over the looser 60s staleTime
 * the CompactionTimeline.tsx consumer previously had.
 *
 * Passing different params from the two call sites (e.g. one omitting
 * `limit` or using a different value) would append a different params
 * object to the queryKey and silently re-split the cache, reintroducing
 * D11 — if you add a new consumer of this hook, pass the same params.
 */
export const useCompactionEvents = createResourceHook<CompactionEventsResponse, CompactionEvent[]>({
  path: '/api/cast/compaction-events',
  queryKey: ['compaction-events'],
  select: (data) => data.events,
  staleTime: 15_000,
  refetchInterval: 30_000,
})
