import { useQuery } from '@tanstack/react-query'

export interface QualityGateEntry {
  id: number
  session_id: string | null
  agent: string | null
  gate_type: string | null
  gate_result: 'pass' | 'block' | 'warn' | string | null
  feedback: string | null
  artifact_count: number | null
  created_at: string | null
}

export interface DispatchDecisionEntry {
  id: number
  session_id: string | null
  prompt_snippet: string | null
  chosen_agent: string | null
  model: string | null
  effort: string | null
  wave_id: string | null
  parallel: number | null
  created_at: string | null
}

async function fetchQualityGates(): Promise<{ gates: QualityGateEntry[] }> {
  const res = await fetch('/api/quality-gates')
  if (!res.ok) throw new Error('Failed to fetch quality gates')
  return res.json()
}

async function fetchDispatchDecisions(): Promise<{ decisions: DispatchDecisionEntry[] }> {
  const res = await fetch('/api/dispatch-decisions')
  if (!res.ok) throw new Error('Failed to fetch dispatch decisions')
  return res.json()
}

export const useQualityGates = () =>
  useQuery({
    queryKey: ['quality-gates'],
    queryFn: fetchQualityGates,
    staleTime: 30_000,
  })

export const useDispatchDecisions = () =>
  useQuery({
    queryKey: ['dispatch-decisions'],
    queryFn: fetchDispatchDecisions,
    staleTime: 30_000,
  })
