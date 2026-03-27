import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AgentMemory {
  id: string
  agent: string
  type: string
  project: string | null
  name: string
  content: string
  created_at: string
  updated_at: string
}

export interface AgentMemoriesData {
  memories: AgentMemory[]
  total: number
}

export interface AgentMemoriesParams {
  agent?: string
  type?: string
  project?: string
  q?: string
}

async function fetchAgentMemories(params: AgentMemoriesParams): Promise<AgentMemoriesData> {
  const searchParams = new URLSearchParams()
  if (params.agent) searchParams.set('agent', params.agent)
  if (params.type) searchParams.set('type', params.type)
  if (params.project) searchParams.set('project', params.project)
  if (params.q) searchParams.set('q', params.q)
  const url = `/api/cast/memories${searchParams.toString() ? `?${searchParams}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch agent memories')
  return res.json()
}

async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`/api/cast/memories/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete memory')
}

export const useAgentMemoriesDb = (params: AgentMemoriesParams = {}) =>
  useQuery({
    queryKey: ['cast', 'memories', params],
    queryFn: () => fetchAgentMemories(params),
    staleTime: 30_000,
  })

export const useDeleteMemory = (params: AgentMemoriesParams = {}) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteMemory,
    onMutate: async (id: string) => {
      const queryKey = ['cast', 'memories', params]
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<AgentMemoriesData>(queryKey)
      queryClient.setQueryData<AgentMemoriesData>(queryKey, old => {
        if (!old) return old
        return {
          memories: old.memories.filter(m => m.id !== id),
          total: Math.max(0, old.total - 1),
        }
      })
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cast', 'memories', params], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cast', 'memories'] })
    },
  })
}
