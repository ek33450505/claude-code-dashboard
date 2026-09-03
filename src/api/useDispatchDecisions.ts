import { createResourceHook } from './createResourceHook'
import type { DispatchDecision } from '../types'

export type { DispatchDecision }

export const useDispatchDecisions = createResourceHook<{ decisions: DispatchDecision[] }>({
  path: '/api/dispatch-decisions',
  queryKey: ['dispatch-decisions'],
  staleTime: 15_000,
  refetchInterval: 30_000,
})
