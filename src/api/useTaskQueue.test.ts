import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useTaskQueue, useDeleteTask } from './useTaskQueue'
import type { TaskQueueData } from './useTaskQueue'

// ─── Fetch mock helpers ──────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  })
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_TASK = {
  id: 'task-42',
  agent: 'code-reviewer',
  priority: 1,
  status: 'pending',
  created_at: '2026-03-26T09:00:00Z',
  retry_count: 0,
  scheduled_for: null,
  result_summary: null,
  task: 'Review PR #7',
}

const MOCK_TASK_QUEUE: TaskQueueData = {
  tasks: [MOCK_TASK],
  counts: { pending: 1, claimed: 0, running: 0, done: 5, failed: 0 },
}

const EMPTY_TASK_QUEUE: TaskQueueData = {
  tasks: [],
  counts: { pending: 0, claimed: 0, running: 0, done: 0, failed: 0 },
}

// ─── useTaskQueue ─────────────────────────────────────────────────────────────

describe('useTaskQueue', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_TASK_QUEUE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useTaskQueue(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/task-queue', async () => {
    const { result } = renderHook(() => useTaskQueue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/task-queue')
  })

  it('returns tasks array and counts on success', async () => {
    const { result } = renderHook(() => useTaskQueue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.tasks).toHaveLength(1)
    expect(data.tasks[0].id).toBe('task-42')
    expect(data.tasks[0].agent).toBe('code-reviewer')
    expect(data.counts.pending).toBe(1)
    expect(data.counts.done).toBe(5)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useTaskQueue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty tasks array when API returns no data', async () => {
    global.fetch = makeFetchOk(EMPTY_TASK_QUEUE)
    const { result } = renderHook(() => useTaskQueue(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.tasks).toHaveLength(0)
    expect(result.current.data!.counts.pending).toBe(0)
  })
})

// ─── useDeleteTask ────────────────────────────────────────────────────────────

describe('useDeleteTask', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends DELETE to /api/cast/task-queue/:id', async () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'task-42' })
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cast/task-queue/task-42',
      { method: 'DELETE' }
    )
  })

  it('skips network DELETE for synthetic agent_runs tasks', async () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: '42', source: 'agent_runs' })
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('mutation is idle before being called', () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(false)
    expect(result.current.isIdle).toBe(true)
  })

  it('resolves successfully when the server responds ok', async () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync({ id: 'task-42' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('surfaces an error when the server responds with not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useDeleteTask(), { wrapper: makeWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 'task-99' })
      } catch {
        // expected
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
