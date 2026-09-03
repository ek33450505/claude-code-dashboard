import { useQuery } from '@tanstack/react-query'
import type {
  QualityGateStats,
  ToolFailure,
  ToolFailureStats,
  ResearchCacheStats,
  DbMemory,
} from '../types'

// ── Quality Gates ────────────────────────────────────────────────────────────

export function useQualityGateStats() {
  return useQuery<QualityGateStats>({
    queryKey: ['quality-gates', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/quality-gates/stats')
      if (!res.ok) throw new Error('Failed to fetch quality gate stats')
      return res.json()
    },
    staleTime: 60_000,
  })
}

// ── Tool Failures ────────────────────────────────────────────────────────────

export function useToolFailures(options?: { limit?: number; since?: string }) {
  return useQuery({
    queryKey: ['tool-failures', options],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.since) params.set('since', options.since)
      const res = await fetch(`/api/cast/tool-failures?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tool failures')
      const data = await res.json()
      return { failures: data.failures as ToolFailure[], total: data.total as number }
    },
    staleTime: 60_000,
  })
}

export function useToolFailureStats() {
  return useQuery<ToolFailureStats>({
    queryKey: ['tool-failures', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/cast/tool-failures/stats')
      if (!res.ok) throw new Error('Failed to fetch tool failure stats')
      return res.json()
    },
    staleTime: 60_000,
  })
}

// ── Research Cache ───────────────────────────────────────────────────────────

export function useResearchCacheStats() {
  return useQuery<ResearchCacheStats>({
    queryKey: ['research-cache', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/cast/research-cache/stats')
      if (!res.ok) throw new Error('Failed to fetch research cache stats')
      return res.json()
    },
    staleTime: 120_000,
  })
}

// ── DB Memories (with importance/decay/retrieval) ────────────────────────────

export function useDbMemories() {
  return useQuery({
    queryKey: ['db-memories'],
    queryFn: async () => {
      const res = await fetch('/api/memory/db-memories')
      if (!res.ok) throw new Error('Failed to fetch DB memories')
      const data = await res.json()
      return data.memories as DbMemory[]
    },
    staleTime: 120_000,
  })
}

// ── Config ───────────────────────────────────────────────────────────────────

// Deliberately NOT on createResourceHook: that factory always throws on a
// non-ok response, whereas this hook falls back to {} when the config
// endpoint is unavailable. Converting it would turn graceful degradation
// into an error state — leave it hand-rolled.
export function useChainMap() {
  return useQuery<Record<string, string[]>>({
    queryKey: ['config', 'chain-map'],
    queryFn: async () => {
      const res = await fetch('/api/config/chain-map')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

// Deliberately NOT on createResourceHook: that factory always throws on a
// non-ok response, whereas this hook falls back to {} when the config
// endpoint is unavailable. Converting it would turn graceful degradation
// into an error state — leave it hand-rolled.
export function usePolicies() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['config', 'policies'],
    queryFn: async () => {
      const res = await fetch('/api/config/policies')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

// Deliberately NOT on createResourceHook: that factory always throws on a
// non-ok response, whereas this hook falls back to {} when the config
// endpoint is unavailable. Converting it would turn graceful degradation
// into an error state — leave it hand-rolled.
export function useModelPricing() {
  return useQuery<Record<string, unknown>>({
    queryKey: ['config', 'model-pricing'],
    queryFn: async () => {
      const res = await fetch('/api/config/model-pricing')
      if (!res.ok) return {}
      return res.json()
    },
    staleTime: 300_000,
  })
}

