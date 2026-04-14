import { useQuery } from '@tanstack/react-query'
import type { SwarmSession, TeammateRun, TeammateMessage } from '../types'

// ── Swarm Sessions List ───────────────────────────────────────────────────────

export function useSwarmSessions() {
  return useQuery<SwarmSession[]>({
    queryKey: ['swarm', 'sessions'],
    queryFn: async () => {
      const res = await fetch('/api/swarm/sessions')
      if (!res.ok) throw new Error('Failed to fetch swarm sessions')
      const data = await res.json()
      return data.sessions as SwarmSession[]
    },
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

// ── Swarm Session Detail ──────────────────────────────────────────────────────

export interface SwarmDetail {
  session: SwarmSession
  teammates: TeammateRun[]
}

export function useSwarmDetail(id: string | null) {
  return useQuery<SwarmDetail>({
    queryKey: ['swarm', 'sessions', id],
    queryFn: async () => {
      const res = await fetch(`/api/swarm/sessions/${id}`)
      if (!res.ok) throw new Error('Swarm not found')
      return res.json() as Promise<SwarmDetail>
    },
    enabled: id !== null,
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

// ── Swarm Messages ────────────────────────────────────────────────────────────

export function useSwarmMessages(id: string | null) {
  return useQuery<TeammateMessage[]>({
    queryKey: ['swarm', 'sessions', id, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/swarm/sessions/${id}/messages`)
      if (!res.ok) throw new Error('Failed to fetch swarm messages')
      const data = await res.json()
      return data.messages as TeammateMessage[]
    },
    enabled: id !== null,
    refetchInterval: 5_000,
    staleTime: 3_000,
  })
}

