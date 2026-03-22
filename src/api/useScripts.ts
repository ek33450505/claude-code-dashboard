import { useQuery } from '@tanstack/react-query'
import type { ScriptFile } from '../types'

export function useScripts() {
  return useQuery<ScriptFile[]>({
    queryKey: ['scripts'],
    queryFn: async () => {
      const res = await fetch('/api/scripts')
      if (!res.ok) throw new Error('Failed to fetch scripts')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useScriptContent(name: string) {
  return useQuery<{ name: string; body: string }>({
    queryKey: ['scripts', name],
    queryFn: async () => {
      const res = await fetch(`/api/scripts/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error('Failed to fetch script content')
      return res.json()
    },
    enabled: !!name,
    staleTime: 60_000,
  })
}
