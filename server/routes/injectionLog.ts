import { makeTableRouter } from '../utils/makeTableRouter.js'

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  score_breakdown: string | null
  injected_at: string
}

export const injectionLogRouter = makeTableRouter({
  table: 'injection_log',
  columns: 'id, session_id, prompt_hash, fact_id, score, injected_at',
  orderBy: 'injected_at DESC',
  key: 'entries',
  tag: 'injection-log',
  limit: { fixed: 100 },
})
