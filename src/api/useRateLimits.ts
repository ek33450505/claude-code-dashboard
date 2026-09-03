import { createResourceHook } from './createResourceHook'

export interface RateLimitSnapshot {
  ts: number
  tpm_limit: number | null
  tpm_used: number | null
  rpm_limit: number | null
  rpm_used: number | null
}

export const useRateLimits = createResourceHook<{
  latest: RateLimitSnapshot | null
  snapshots: RateLimitSnapshot[]
}>({
  path: '/api/rate-limits',
  queryKey: ['rate-limits'],
  staleTime: 30_000,
  refetchInterval: 60_000,
})
