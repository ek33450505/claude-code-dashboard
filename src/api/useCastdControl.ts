import { createResourceHook } from './createResourceHook'

export interface CastdStatus {
  running: boolean
  entries: string[]
  count: number
  error?: string
}

interface CastdStatusResponse {
  entries?: string[]
  count?: number
  error?: string
}

export const useCastdStatus = createResourceHook<CastdStatusResponse, CastdStatus>({
  path: '/api/castd/status',
  queryKey: ['castd', 'status'],
  // Server returns { entries, count, error? } — derive 'running' from count > 0
  select: (data) => ({
    running: (data.count ?? 0) > 0,
    entries: data.entries ?? [],
    count: data.count ?? 0,
    error: data.error,
  }),
  refetchInterval: 10_000,
  refetchIntervalInBackground: false,
})
