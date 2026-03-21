import { useQuery } from '@tanstack/react-query'

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
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  const res = await fetch('/api/analytics')
  if (!res.ok) throw new Error('Failed to fetch analytics')
  return res.json()
}

export const useAnalytics = () =>
  useQuery({
    queryKey: ['analytics'],
    queryFn: fetchAnalytics,
    staleTime: 120_000, // 2 minutes
  })
