import { useQuery } from '@tanstack/react-query'
import { createResourceHook } from './createResourceHook'
import type { PlanFile } from '../types'

async function fetchPlans(): Promise<PlanFile[]> {
  const res = await fetch('/api/plans')
  if (!res.ok) throw new Error('Failed to fetch plans')
  return res.json()
}

export const usePlans = () =>
  useQuery({ queryKey: ['plans'], queryFn: fetchPlans })

export const usePlan = createResourceHook<PlanFile & { body: string }>({
  path: (params) => `/api/plans/${encodeURIComponent(String(params?.filename ?? ''))}`,
  queryKey: ['plans'],
  enabled: (params) => !!params?.filename,
})

export interface PlanSession {
  id: number
  session_id: string | null
  plan_file: string | null
  started_at: string
}

export const usePlanSessions = () =>
  useQuery<{ sessions: PlanSession[] }>({
    queryKey: ['plan-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/plans/sessions')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/plans/sessions`)
      return res.json()
    },
    staleTime: 30_000,
  })
