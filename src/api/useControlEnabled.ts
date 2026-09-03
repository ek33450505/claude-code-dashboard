import { createResourceHook } from './createResourceHook'

export interface ControlStatus {
  enabled: boolean
  tokenConfigured: boolean
}

/**
 * Reports whether the dashboard's write surface is enabled on the server.
 * Drives show/hide of every control affordance — the dashboard is read-only
 * unless the operator opted in via CAST_DASHBOARD_CONTROL=1.
 */
export const useControlStatus = createResourceHook<{ enabled: unknown; tokenConfigured: unknown }, ControlStatus>({
  path: '/api/config/control',
  queryKey: ['config', 'control'],
  select: (data) => ({
    enabled: Boolean(data.enabled),
    tokenConfigured: Boolean(data.tokenConfigured),
  }),
  staleTime: 60_000,
})
