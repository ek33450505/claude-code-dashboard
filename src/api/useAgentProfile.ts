import { createResourceHook } from './createResourceHook'

export interface AgentRunRow {
  started_at: string
  ended_at: string | null
  duration_ms: number | null
  status: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  task_summary: string | null
  model: string | null
  is_truncated: number
}

export interface AgentProfileDetail {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
  last_runs: AgentRunRow[]
}

export const useAgentProfile = createResourceHook<AgentProfileDetail>({
  path: (params) => `/api/analytics/profile/${encodeURIComponent(String(params?.agent ?? ''))}`,
  queryKey: ['analytics', 'profile'],
  staleTime: 60_000,
  enabled: (params) => !!params?.agent,
})

export interface AgentScorecardRow {
  name: string
  runs: number
  success_rate: number
  blocked_count: number
  avg_cost_usd: number
}

export const useAgentScorecard = createResourceHook<{ agents: AgentScorecardRow[] }>({
  path: '/api/analytics/profile',
  queryKey: ['analytics', 'scorecard'],
  staleTime: 60_000,
  refetchInterval: 120_000,
})
