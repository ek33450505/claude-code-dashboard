import { createResourceHook } from './createResourceHook'
import type { OutputFile } from '../types'

export const useOutputs = createResourceHook<OutputFile[]>({
  path: (params) => `/api/outputs/${params?.category}`,
  queryKey: ['outputs'],
  staleTime: 30_000,
  enabled: (params) => !!params?.category,
})
