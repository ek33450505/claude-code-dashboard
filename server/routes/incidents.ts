import { makeTableRouter } from '../utils/makeTableRouter.js'

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

export const incidentsRouter = makeTableRouter({
  table: 'incidents',
  columns:
    'id, occurred_at, problem_summary, fix_summary, related_files, related_commit, resolution_status, surfaced_by',
  orderBy: 'occurred_at DESC',
  key: 'incidents',
  tag: 'incidents',
})
