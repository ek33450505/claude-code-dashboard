import { createResourceHook } from './createResourceHook'

export interface DelegationSavings {
  savedUSD: number
  hypotheticalSonnetCostUSD: number
  actualCostUSD: number
  haikuUtilizationPct: number
  dispatches: { haiku: number; sonnet: number; opus: number }
}

export interface AnalyticsData {
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  estimatedCostUSD: number
  sessionsByDay: Array<{ date: string; sessions: number; inputTokens: number; outputTokens: number; cost: number }>
  sessionsByProject: Array<{ project: string; sessions: number; tokens: number; cost: number }>
  toolUsage: Array<{ tool: string; count: number }>
  modelBreakdown: Array<{ model: string; sessions: number; tokens: number; cost: number }>
  avgSessionDurationMs: number
  avgTokensPerSession: number
  delegationSavings?: DelegationSavings
  monthPrefix?: string | null
}

export const useAnalytics = createResourceHook<AnalyticsData>({
  path: '/api/analytics',
  queryKey: ['analytics'],
  staleTime: 120_000, // 2 minutes
})
