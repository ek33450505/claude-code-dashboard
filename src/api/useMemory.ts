import { createResourceHook } from './createResourceHook'
import type { MemoryFile } from '../types'

export const useAgentMemory = createResourceHook<MemoryFile[]>({
  path: '/api/memory/agent',
  queryKey: ['memory', 'agent'],
})

export const useProjectMemory = createResourceHook<MemoryFile[]>({
  path: '/api/memory/project',
  queryKey: ['memory', 'project'],
})
