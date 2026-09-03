import { createResourceHook } from './createResourceHook'

export type SummaryRange = 'today' | 'week'

export interface RunsByStatus {
  DONE: number
  DONE_WITH_CONCERNS: number
  BLOCKED: number
  NEEDS_CONTEXT: number
  RUNNING: number
  OTHER: number
}

export interface TopAgent {
  agent: string
  count: number
  costUsd: number
}

export interface BlockerEntry {
  id: string | number
  agent: string
  status: string
  started_at: string
  work_log_snippet: string
}

export interface SummaryHighlights {
  plansActive: number
  hookFailures24h: number
  qualityGatePassRate: number | null
}

export interface ExecutiveSummaryData {
  range: SummaryRange
  generatedAt: string
  runs: {
    total: number
    byStatus: RunsByStatus
  }
  cost: {
    todayUsd: number
    weekUsd: number
    vsPrior7dPct: number | null
  }
  topAgents: TopAgent[]
  blockers: BlockerEntry[]
  highlights: SummaryHighlights
  /** null = count could not be taken (db unavailable); 0 = counted, nothing missing */
  runs_missing_cost: number | null
}

export const useExecutiveSummary = createResourceHook<ExecutiveSummaryData>({
  path: '/api/executive-summary',
  queryKey: ['executive-summary'],
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
})
