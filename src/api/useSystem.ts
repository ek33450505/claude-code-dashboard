import { createResourceHook } from './createResourceHook'
import type { SystemOverview } from '../types'

export const useSystemHealth = createResourceHook<SystemOverview>({
  path: '/api/health',
  queryKey: ['health'],
})
