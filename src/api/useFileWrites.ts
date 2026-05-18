import { useQuery } from '@tanstack/react-query'

export interface FileWrite {
  id: number
  session_id: string
  agent_name: string
  run_id: string | null
  file_path: string
  tool_name: string
  ts: string
  line_range: string | null
}

export function useFileWrites(params?: { limit?: number; offset?: number }) {
  return useQuery<{ entries: FileWrite[]; total: number }>({
    queryKey: ['file-writes', params],
    queryFn: async () => {
      const url = new URL('/api/file-writes', window.location.origin)
      if (params?.limit != null) url.searchParams.set('limit', String(params.limit))
      if (params?.offset != null) url.searchParams.set('offset', String(params.offset))
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`API error ${res.status}: /api/file-writes`)
      return res.json()
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useFileWritesStats() {
  return useQuery<{ byAgent: Record<string, number> }>({
    queryKey: ['file-writes', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/file-writes/stats')
      if (!res.ok) throw new Error(`API error ${res.status}: /api/file-writes/stats`)
      return res.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
