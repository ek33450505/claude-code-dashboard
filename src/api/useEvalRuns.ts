import { createResourceHook } from './createResourceHook'

export interface EvalRun {
  id: string
  eval_id: string
  agent: string
  attempt: number
  agent_run_id: string | null
  status: string
  grader_results: string | null
  pass_at_k: number | null
  k: number | null
  duration_ms: number | null
  started_at: string
  ended_at: string | null
  model: string | null
  cost_tier: string | null
}

export const useEvalRuns = createResourceHook<{ runs: EvalRun[] }>({
  path: '/api/eval-runs',
  queryKey: ['eval-runs'],
  staleTime: 30_000,
  refetchInterval: 60_000,
})
