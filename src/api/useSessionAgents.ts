import { createResourceHook } from './createResourceHook'
import type { SessionAgentRun } from '../types'

export const useSessionAgents = createResourceHook<{ runs: SessionAgentRun[] }>({
  path: (params) => `/api/cast/session-agents/${encodeURIComponent(String(params?.sessionId ?? ''))}`,
  queryKey: ['cast', 'session-agents'],
  enabled: (params) => !!params?.sessionId,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
})

export const useWorktrees = createResourceHook<{
  worktrees: Array<{ path: string; branch: string | null; head: string }>
}>({
  path: '/api/cast/worktrees',
  queryKey: ['cast', 'worktrees'],
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
})
