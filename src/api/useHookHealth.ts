import { createResourceHook } from './createResourceHook'

export interface HookHealthEntry {
  hook_type: string
  command: string
  script_path: string | null
  exists: boolean
  executable: boolean
  last_fired_at: string | null
  health: 'green' | 'yellow' | 'red'
}

export interface HookHealthData {
  hooks: HookHealthEntry[]
}

export const useHookHealth = createResourceHook<HookHealthData>({
  path: '/api/hooks/health',
  queryKey: ['hooks', 'health'],
  staleTime: 30_000,
})
