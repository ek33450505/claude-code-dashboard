import { createResourceHook } from './createResourceHook'
import type { AgentRun } from './useAgentRuns'

export const useActiveAgents = createResourceHook<{ runs: AgentRun[] }, AgentRun[]>({
  path: '/api/cast/active-agents',
  queryKey: ['cast', 'active-agents'],
  select: (data) => data.runs,
  refetchInterval: 5_000,
  staleTime: 3_000,
  refetchIntervalInBackground: false,
})
