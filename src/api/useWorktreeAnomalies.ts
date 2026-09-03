import { createResourceHook } from './createResourceHook'

export interface WorktreeAnomaly {
  id: number
  agent_id: string | null
  worktree_path: string | null
  detected_at: string
  repo_root: string | null
  state: string | null
  reason: string | null
}

export const useWorktreeAnomalies = createResourceHook<{
  anomalies: WorktreeAnomaly[]
  total: number
}>({
  path: '/api/worktree-anomalies',
  queryKey: ['worktree-anomalies'],
  staleTime: 30_000,
  refetchInterval: 60_000,
})
