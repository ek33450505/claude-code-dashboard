import { useQuery } from '@tanstack/react-query'

export interface AgentRun {
  id: string
  session_id: string
  agent: string
  model: string
  started_at: string
  ended_at: string | null
  status: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  task_summary: string | null
  project: string | null
  commit_sha: string | null
}

export interface AgentRunStats {
  totalRuns: number
  totalCostUsd: number
  byAgent: Record<string, number>
  byStatus: Record<string, number>
}

export interface AgentRunsData {
  runs: AgentRun[]
  stats: AgentRunStats
}

export interface AgentRunsParams {
  limit?: number
  agent?: string
  status?: string
  since?: string
}

async function fetchAgentRuns(params: AgentRunsParams): Promise<AgentRunsData> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.agent) searchParams.set('agent', params.agent)
  if (params.status) searchParams.set('status', params.status)
  if (params.since) searchParams.set('since', params.since)
  const url = `/api/cast/agent-runs${searchParams.toString() ? `?${searchParams}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch agent runs')
  return res.json()
}

export const useAgentRuns = (params: AgentRunsParams = {}) =>
  useQuery({
    queryKey: ['cast', 'agent-runs', params],
    queryFn: () => fetchAgentRuns(params),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })
