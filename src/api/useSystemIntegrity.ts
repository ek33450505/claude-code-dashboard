import { createResourceHook } from './createResourceHook'

export interface SystemIntegrity {
  litestream: { active: boolean; seq: number | null }
  snapshots: { dir: string; lastBackupAt: string | null; count: number }
}

export const useSystemIntegrity = createResourceHook<SystemIntegrity>({
  path: '/api/system/integrity',
  queryKey: ['system-integrity'],
  staleTime: 60_000,
  refetchInterval: 120_000,
})
