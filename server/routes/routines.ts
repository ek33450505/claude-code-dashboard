import { makeTableRouter } from '../utils/makeTableRouter.js'
import { relativizeHome } from '../utils/relativizeHome.js'

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

export const routinesRouter = makeTableRouter({
  table: 'routines',
  columns:
    'id, name, trigger_type, trigger_value, agent_to_dispatch, enabled, last_run_at, last_run_status, last_run_output_path, created_at',
  orderBy: 'name ASC',
  key: 'routines',
  tag: 'routines',
  // last_run_output_path is a DB column written under ~/.claude/routines-output/
  // by the flagship's routine runner — relativize on the way out (public,
  // unauthenticated GET). Nothing downstream reuses this field for I/O.
  mapRow: (r: RoutineRow) => ({
    ...r,
    last_run_output_path: relativizeHome(r.last_run_output_path ?? undefined) ?? null,
  }),
})
