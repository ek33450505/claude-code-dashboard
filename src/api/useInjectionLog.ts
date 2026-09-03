import { createResourceHook } from './createResourceHook'

export interface InjectionLogEntry {
  id: number
  session_id: string | null
  prompt_hash: string
  fact_id: number
  score: number | null
  injected_at: string
}

export const useInjectionLog = createResourceHook<{ entries: InjectionLogEntry[] }>({
  path: '/api/injection-log',
  queryKey: ['injection-log'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})
