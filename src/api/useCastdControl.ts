import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface CastdStatus {
  running: boolean
  pid: number | null
  queueDepth: number
}

export interface CastdLogs {
  lines: string[]
}

async function fetchCastdStatus(): Promise<CastdStatus> {
  const res = await fetch('/api/castd/status')
  if (!res.ok) throw new Error('Failed to fetch castd status')
  return res.json()
}

async function fetchCastdLogs(): Promise<CastdLogs> {
  const res = await fetch('/api/castd/logs')
  if (!res.ok) throw new Error('Failed to fetch castd logs')
  return res.json()
}

async function startCastd(): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/castd/start', { method: 'POST' })
  return res.json()
}

async function stopCastd(): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/castd/stop', { method: 'POST' })
  return res.json()
}

export const useCastdStatus = () =>
  useQuery({
    queryKey: ['castd', 'status'],
    queryFn: fetchCastdStatus,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })

export const useCastdLogs = () =>
  useQuery({
    queryKey: ['castd', 'logs'],
    queryFn: fetchCastdLogs,
    staleTime: 10_000,
  })

export const useCastdStart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: startCastd,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    },
  })
}

export const useCastdStop = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: stopCastd,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    },
  })
}
