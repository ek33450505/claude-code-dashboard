import { useQuery } from '@tanstack/react-query'
import { createResourceHook } from './createResourceHook'
import type { Session, LogEntry } from '../types'

async function fetchSessions(project?: string, limit?: number): Promise<Session[]> {
  const params = new URLSearchParams()
  if (project) params.set('project', project)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  const res = await fetch(`/api/sessions${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
}

export const useSessions = (project?: string, limit?: number) =>
  useQuery({
    queryKey: ['sessions', project, limit],
    queryFn: () => fetchSessions(project, limit),
  })

// project is a projectEncoded value that is already URL-safe; encoding it
// again would double-encode and break the route, so this is intentionally
// NOT run through encodeURIComponent.
export const useSession = createResourceHook<LogEntry[]>({
  path: (params) => `/api/sessions/${params?.project}/${params?.id}`,
  queryKey: ['sessions'],
  enabled: (params) => !!params?.project && !!params?.id,
})
