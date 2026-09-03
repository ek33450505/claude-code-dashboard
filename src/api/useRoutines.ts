import { createResourceHook } from './createResourceHook'

export interface RoutineRow {
  id: string
  name: string
  trigger_type: string
  trigger_value: string | null
  agent_to_dispatch: string
  enabled: number
  last_run_at: string | null
  last_run_status: string | null
  last_run_output_path: string | null
  created_at: string
}

export const useRoutines = createResourceHook<{ routines: RoutineRow[] }>({
  path: '/api/routines',
  queryKey: ['routines'],
  staleTime: 60_000,
  refetchInterval: 120_000,
})
