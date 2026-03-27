import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Task {
  id: string
  agent: string
  priority: number
  status: string
  created_at: string
  retry_count: number
  scheduled_for: string | null
  result_summary: string | null
  task: string | null
}

export interface TaskCounts {
  pending: number
  claimed: number
  done: number
  failed: number
}

export interface TaskQueueData {
  tasks: Task[]
  counts: TaskCounts
}

async function fetchTaskQueue(): Promise<TaskQueueData> {
  const res = await fetch('/api/cast/task-queue')
  if (!res.ok) throw new Error('Failed to fetch task queue')
  return res.json()
}

async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/cast/task-queue/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete task')
}

export const useTaskQueue = () =>
  useQuery({
    queryKey: ['cast', 'task-queue'],
    queryFn: fetchTaskQueue,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })

export const useDeleteTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTask,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['cast', 'task-queue'] })
      const previous = queryClient.getQueryData<TaskQueueData>(['cast', 'task-queue'])
      queryClient.setQueryData<TaskQueueData>(['cast', 'task-queue'], old => {
        if (!old) return old
        const tasks = old.tasks.filter(t => t.id !== id)
        const counts = { ...old.counts }
        const removed = old.tasks.find(t => t.id === id)
        if (removed && removed.status in counts) {
          counts[removed.status as keyof TaskCounts] = Math.max(0, counts[removed.status as keyof TaskCounts] - 1)
        }
        return { tasks, counts }
      })
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['cast', 'task-queue'], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cast', 'task-queue'] })
    },
  })
}
