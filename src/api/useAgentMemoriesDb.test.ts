import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useAgentMemoriesDb, useDeleteMemory } from './useAgentMemoriesDb'
import type { AgentMemoriesData } from './useAgentMemoriesDb'

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

const MOCK_MEMORY = {
  id: 'mem-1',
  agent: 'code-writer',
  type: 'feedback',
  project: 'my-project',
  name: 'testing_convention',
  content: 'Always use getByRole over getByTestId.',
  created_at: '2026-03-20T08:00:00Z',
  updated_at: '2026-03-26T08:00:00Z',
}

const MOCK_MEMORIES: AgentMemoriesData = {
  memories: [MOCK_MEMORY],
  total: 1,
}

const EMPTY_MEMORIES: AgentMemoriesData = {
  memories: [],
  total: 0,
}

// ─── useAgentMemoriesDb ───────────────────────────────────────────────────────

describe('useAgentMemoriesDb', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_MEMORIES)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useAgentMemoriesDb(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/memories with no params', async () => {
    const { result } = renderHook(() => useAgentMemoriesDb(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/memories')
  })

  it('appends query params when provided', async () => {
    const { result } = renderHook(
      () => useAgentMemoriesDb({ agent: 'code-writer', type: 'feedback', project: 'my-project', q: 'convention' }),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('agent=code-writer')
    expect(url).toContain('type=feedback')
    expect(url).toContain('project=my-project')
    expect(url).toContain('q=convention')
  })

  it('returns memories array and total on success', async () => {
    const { result } = renderHook(() => useAgentMemoriesDb(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.memories).toHaveLength(1)
    expect(data.memories[0].agent).toBe('code-writer')
    expect(data.memories[0].type).toBe('feedback')
    expect(data.total).toBe(1)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useAgentMemoriesDb(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty memories array when API returns no data', async () => {
    global.fetch = makeFetchOk(EMPTY_MEMORIES)
    const { result } = renderHook(() => useAgentMemoriesDb(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.memories).toHaveLength(0)
    expect(result.current.data!.total).toBe(0)
  })
})

// ─── useDeleteMemory ──────────────────────────────────────────────────────────

describe('useDeleteMemory', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends DELETE to /api/cast/memories/:id', async () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteMemory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('mem-1')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/cast/memories/mem-1',
      { method: 'DELETE' }
    )
  })

  it('mutation is idle before being called', () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteMemory(), { wrapper: makeWrapper() })
    expect(result.current.isPending).toBe(false)
    expect(result.current.isIdle).toBe(true)
  })

  it('resolves successfully when the server responds ok', async () => {
    global.fetch = makeFetchOk(undefined)
    const { result } = renderHook(() => useDeleteMemory(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync('mem-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('surfaces an error when the server responds with not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useDeleteMemory(), { wrapper: makeWrapper() })

    await act(async () => {
      try {
        await result.current.mutateAsync('mem-999')
      } catch {
        // expected
      }
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
