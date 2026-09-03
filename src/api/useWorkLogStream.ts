import { createResourceHook } from './createResourceHook'

// Re-declared locally — do NOT import from server/ (frontend/backend are separate)
export interface ParsedWorkLog {
  items: string[]
  filesRead: string[]
  filesChanged: string[]
  codeReviewerResult?: string
  testWriterResult?: string
  decisions: string[]
}

export interface WorkLogEntry {
  agentRunId: string
  agentName: string
  model: string | null
  sessionId: string | null
  startedAt: string
  status: string | null
  workLog: ParsedWorkLog | null
  partialWorkLog: string | null
  isTruncated: boolean
  qualityGateVerdict: string | null
  dispatchedBy: string | null
  dispatchedTo: string[] | null
}

export interface WorkLogStreamData {
  entries: WorkLogEntry[]
}

export interface WorkLogStreamParams {
  limit?: number
  since?: string
}

export const useWorkLogStream = createResourceHook<WorkLogStreamData>({
  path: '/api/work-log-stream',
  queryKey: ['cast', 'work-log-stream'],
  staleTime: 10_000,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
})
