import { useQuery } from '@tanstack/react-query'

export interface BudgetStatus {
  today_spend: number
  daily_limit: number | null
  pct_used: number | null
  over_budget: boolean
  alert_at_pct: number | null
}

async function fetchBudgetStatus(): Promise<BudgetStatus> {
  const res = await fetch('/api/budget/status')
  if (!res.ok) throw new Error('Failed to fetch budget status')
  return res.json()
}

export const useBudgetStatus = () =>
  useQuery({
    queryKey: ['budget', 'status'],
    queryFn: fetchBudgetStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
