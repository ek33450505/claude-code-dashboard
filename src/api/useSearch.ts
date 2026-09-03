import { createResourceHook } from './createResourceHook'

export interface SearchResults {
  sessions: Array<{ id: string; project: string; projectEncoded: string; startedAt: string; slug?: string; matchReason: string }>
  agents: Array<{ name: string; description: string; model: string; color: string }>
  plans: Array<{ filename: string; title: string; date: string; preview: string }>
  memories: Array<{ agent: string; name?: string; description?: string; type?: string; path: string }>
}

export const useSearch = createResourceHook<SearchResults>({
  path: (params) => `/api/search?q=${encodeURIComponent(String(params?.query ?? ''))}`,
  queryKey: ['search'],
  enabled: (params) => typeof params?.query === 'string' && params.query.length >= 2,
  staleTime: 30_000,
})
