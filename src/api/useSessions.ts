import { createResourceHook } from './createResourceHook'
import type { Session, LogEntry } from '../types'

export const useSessions = createResourceHook<Session[]>({
  path: '/api/sessions',
  queryKey: ['sessions'],
})

// project is a projectEncoded value that is already URL-safe; encoding it
// again would double-encode and break the route, so this is intentionally
// NOT run through encodeURIComponent.
export const useSession = createResourceHook<LogEntry[]>({
  path: (params) => `/api/sessions/${params?.project}/${params?.id}`,
  queryKey: ['sessions'],
  enabled: (params) => !!params?.project && !!params?.id,
})
