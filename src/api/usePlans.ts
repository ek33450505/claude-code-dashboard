import { createResourceHook } from './createResourceHook'
import type { PlanFile } from '../types'

export const usePlans = createResourceHook<PlanFile[]>({
  path: '/api/plans',
  queryKey: ['plans'],
})

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

export const usePlanSessions = createResourceHook<{ sessions: PlanSession[] }>({
  path: '/api/plans/sessions',
  queryKey: ['plan-sessions'],
  staleTime: 30_000,
})
