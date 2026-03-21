import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentDefinition } from '../types'

interface AgentUpdatePayload {
  model?: string
  color?: string
  description?: string
  tools?: string[]
  disallowedTools?: string[]
  maxTurns?: number
  memory?: string
}

interface AgentCreatePayload extends AgentUpdatePayload {
  name: string
}

async function updateAgent(name: string, data: AgentUpdatePayload): Promise<AgentDefinition> {
  const res = await fetch(`/api/agents/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to update agent')
  }
  return res.json()
}

async function createNewAgent(data: AgentCreatePayload): Promise<AgentDefinition> {
  const res = await fetch('/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to create agent')
  }
  return res.json()
}

export function useUpdateAgent(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AgentUpdatePayload) => updateAgent(name, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
      qc.invalidateQueries({ queryKey: ['agents', name] })
    },
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createNewAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}
