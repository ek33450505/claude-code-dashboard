import { createResourceHook } from './createResourceHook'
import type { AgentDefinition } from '../types'

export const useAgents = createResourceHook<AgentDefinition[]>({
  path: '/api/agents',
  queryKey: ['agents'],
  staleTime: 60_000,
})

export const useAgent = createResourceHook<AgentDefinition & { body: string }>({
  path: (params) => `/api/agents/${params?.name}`,
  queryKey: ['agents'],
  enabled: (params) => !!params?.name,
})
