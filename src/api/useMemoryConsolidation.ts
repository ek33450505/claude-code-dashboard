import { createResourceHook } from './createResourceHook'

export interface MemoryConsolidationRun {
  id: number
  run_id: string
  project_id: string | null
  status: string | null
  memory_files_read: number | null
  transcripts_scanned: number | null
  candidates_written: number | null
  started_at: string | null
  completed_at: string | null
  error: string | null
}

export const useMemoryConsolidation = createResourceHook<{
  runs: MemoryConsolidationRun[]
  archivedCount: number
}>({
  path: '/api/memory-consolidation',
  queryKey: ['memory-consolidation'],
  staleTime: 30_000,
})
