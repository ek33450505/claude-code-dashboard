import { createResourceHook } from './createResourceHook'

export interface IncidentRow {
  id: string
  occurred_at: string
  problem_summary: string
  fix_summary: string | null
  related_files: string | null
  related_commit: string | null
  resolution_status: string | null
  surfaced_by: string | null
}

export const useIncidents = createResourceHook<{ incidents: IncidentRow[] }>({
  path: '/api/incidents',
  queryKey: ['incidents'],
  staleTime: 120_000,
})
