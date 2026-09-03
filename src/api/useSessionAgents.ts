import { useQuery } from '@tanstack/react-query'
import { createResourceHook } from './createResourceHook'
import type { SessionAgentRun } from '../types'

export const useSessionAgents = createResourceHook<{ runs: SessionAgentRun[] }>({
  path: (params) => `/api/cast/session-agents/${encodeURIComponent(String(params?.sessionId ?? ''))}`,
  queryKey: ['cast', 'session-agents'],
  enabled: (params) => !!params?.sessionId,
  refetchInterval: 15_000,
  refetchIntervalInBackground: false,
})

// Fetch worktree info
async function fetchWorktrees(): Promise<{ worktrees: Array<{ path: string; branch: string | null; head: string }> }> {
  const res = await fetch('/api/cast/worktrees')
  if (!res.ok) throw new Error('Failed to fetch worktrees')
  return res.json()
}

export function useWorktrees() {
  return useQuery({
    queryKey: ['cast', 'worktrees'],
    queryFn: fetchWorktrees,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
