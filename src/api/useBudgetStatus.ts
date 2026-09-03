import { createResourceHook } from './createResourceHook'

export interface BudgetStatus {
  today_spend: number
  daily_limit: number | null
  pct_used: number | null
  over_budget: boolean
  alert_at_pct: number | null
  /** null = count could not be taken (db unavailable); 0 = counted, nothing missing */
  runs_missing_cost: number | null
}

export const useBudgetStatus = createResourceHook<BudgetStatus>({
  path: '/api/budget/status',
  queryKey: ['budget', 'status'],
  staleTime: 60_000,
  refetchInterval: 60_000,
})
