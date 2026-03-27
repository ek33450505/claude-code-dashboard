import { useQuery } from '@tanstack/react-query'
import type { SystemOverview } from '../types'

export interface OllamaHealth {
  connected: boolean
  models: string[]
}

async function fetchHealth(): Promise<SystemOverview> {
  const res = await fetch('/api/health')
  if (!res.ok) throw new Error('Failed to fetch system health')
  return res.json()
}

async function fetchConfig(): Promise<Record<string, unknown>> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to fetch config')
  return res.json()
}

async function fetchOllamaHealth(): Promise<OllamaHealth> {
  const res = await fetch('/api/health/ollama')
  if (!res.ok) return { connected: false, models: [] }
  return res.json()
}

export const useSystemHealth = () =>
  useQuery({ queryKey: ['health'], queryFn: fetchHealth })

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: fetchConfig })

export const useOllamaHealth = () =>
  useQuery({
    queryKey: ['health', 'ollama'],
    queryFn: fetchOllamaHealth,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  })
