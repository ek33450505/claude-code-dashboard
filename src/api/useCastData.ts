import { useQuery } from '@tanstack/react-query'
import { createResourceHook } from './createResourceHook'
import type {
  QualityGateStats,
  ToolFailure,
  ToolFailureStats,
  ResearchCacheStats,
  DbMemory,
  AckEvent,
  ProvenanceChainEntry,
  CommitProvenanceEntry,
  Attestation,
} from '../types'

// ── Quality Gates ────────────────────────────────────────────────────────────

export const useQualityGateStats = createResourceHook<QualityGateStats>({
  path: '/api/quality-gates/stats',
  queryKey: ['quality-gates', 'stats'],
  staleTime: 60_000,
})

// ── Tool Failures ────────────────────────────────────────────────────────────

export const useToolFailures = createResourceHook<
  { failures: ToolFailure[]; total: number },
  { failures: ToolFailure[]; total: number }
>({
  path: '/api/cast/tool-failures',
  queryKey: ['tool-failures'],
  select: (data) => ({ failures: data.failures, total: data.total }),
  staleTime: 60_000,
})

export const useToolFailureStats = createResourceHook<ToolFailureStats>({
  path: '/api/cast/tool-failures/stats',
  queryKey: ['tool-failures', 'stats'],
  staleTime: 60_000,
})

// ── Research Cache ───────────────────────────────────────────────────────────

export const useResearchCacheStats = createResourceHook<ResearchCacheStats>({
  path: '/api/cast/research-cache/stats',
  queryKey: ['research-cache', 'stats'],
  staleTime: 120_000,
})

// ── DB Memories (with importance/decay/retrieval) ────────────────────────────

export const useDbMemories = createResourceHook<{ memories: DbMemory[] }, DbMemory[]>({
  path: '/api/memory/db-memories',
  queryKey: ['db-memories'],
  select: (data) => data.memories,
  staleTime: 120_000,
})

// ── Hatches / Provenance (v10) ───────────────────────────────────────────────

export const useAckEvents = createResourceHook<{ events: AckEvent[] }, AckEvent[]>({
  path: '/api/cast/ack-events',
  queryKey: ['ack-events'],
  select: (data) => data.events,
  staleTime: 60_000,
})

export const useProvenanceChain = createResourceHook<
  { chain: ProvenanceChainEntry[] },
  ProvenanceChainEntry[]
>({
  path: '/api/cast/provenance-chain',
  queryKey: ['provenance-chain'],
  select: (data) => data.chain,
  staleTime: 60_000,
})

export const useCommitProvenance = createResourceHook<
  { commits: CommitProvenanceEntry[] },
  CommitProvenanceEntry[]
>({
  path: '/api/cast/commit-provenance',
  queryKey: ['commit-provenance'],
  select: (data) => data.commits,
  staleTime: 60_000,
})

export const useAttestations = createResourceHook<
  { attestations: Attestation[] },
  Attestation[]
>({
  path: '/api/cast/attestations',
  queryKey: ['attestations'],
  select: (data) => data.attestations,
  staleTime: 60_000,
})

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

