import { createResourceHook } from './createResourceHook'

export interface CostTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

export interface CostModelEntry {
  model: string
  costUsd: number
  sessionCount: number
  inputTokens: number
  outputTokens: number
}

export interface CostTopSession {
  id: string
  project: string
  startedAt: string
  model: string
  costUsd: number
}

export interface CostSummaryResponse {
  totals: CostTotals
  byModel: CostModelEntry[]
  topSessions: CostTopSession[]
  windowDays: number
}

export const useCostSummary = createResourceHook<CostSummaryResponse>({
  path: '/api/cast/cost-summary',
  queryKey: ['cost-summary'],
  staleTime: 60_000,
  refetchInterval: 120_000,
})
