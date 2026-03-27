import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { RoutingStats, RoutingRule } from '../types'

export interface RouteProposal {
  id: string
  patterns: string[]
  agent: string
  model: string
  confidence: string
  frequency: number
  example_prompts: string[]
  status: 'pending' | 'installed' | 'rejected'
}

export function useRoutingProposals() {
  return useQuery<{ proposals: RouteProposal[]; pendingCount: number }>({
    queryKey: ['routing', 'proposals'],
    queryFn: async () => {
      const res = await fetch('/api/routing/proposals')
      if (!res.ok) throw new Error('Failed to fetch routing proposals')
      return res.json()
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  })
}

export function useProposalAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'approve' | 'reject' }) => {
      const res = await fetch(`/api/routing/proposals/${id}/${action}`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? 'Action failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routing', 'proposals'] })
      queryClient.invalidateQueries({ queryKey: ['routing', 'table'] })
    },
  })
}

export function useRoutingStats() {
  return useQuery<RoutingStats>({
    queryKey: ['routing', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/routing/stats')
      if (!res.ok) throw new Error('Failed to fetch routing stats')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

export function useRoutingTable() {
  return useQuery<{ routes: Array<{ agent: string; command: string; patternCount: number }> }>({
    queryKey: ['routing', 'table'],
    queryFn: async () => {
      const res = await fetch('/api/routing/table')
      if (!res.ok) throw new Error('Failed to fetch routing table')
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useRoutingRules() {
  return useQuery<RoutingRule[]>({
    queryKey: ['routing', 'rules'],
    queryFn: async () => {
      const res = await fetch('/api/routing/table')
      if (!res.ok) throw new Error('Failed to fetch routing rules')
      const data = await res.json()
      return data.routes
    },
    staleTime: 60_000,
  })
}
