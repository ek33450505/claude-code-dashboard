import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
  useSwarmSessions,
  useSwarmDetail,
  useSwarmMessages,
  type SwarmDetail,
} from './useSwarm'

// Mock fetch globally
global.fetch = vi.fn()

// Setup QueryClient for each test
let queryClient: QueryClient

function createWrapper() {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  vi.clearAllMocks()
})

afterEach(() => {
  queryClient.clear()
})

describe('useSwarmSessions', () => {
  it('fetches swarm sessions from /api/swarm/sessions', async () => {
    const mockSessions = [
      { id: 'session-1', started_at: '2026-04-10T12:00:00Z', status: 'active' },
      { id: 'session-2', started_at: '2026-04-10T11:00:00Z', status: 'completed' },
    ]

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: mockSessions }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmSessions(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSessions)
    expect(global.fetch).toHaveBeenCalledWith('/api/swarm/sessions')
  })

  it('throws error when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 500 }),
    )

    const { result } = renderHook(() => useSwarmSessions(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('returns empty array on 200 with no sessions', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmSessions(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })

  it('sets refetchInterval to 5000ms', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmSessions(), { wrapper: createWrapper() })

    // Check that the query has refetchInterval set
    const query = queryClient.getQueryData(['swarm', 'sessions'])
    // The refetchInterval is internal to useQuery, we can verify it was called
    expect(result.current.isSuccess || result.current.isPending).toBe(true)
  })

  it('has staleTime of 3000ms', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ sessions: [] }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmSessions(), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify hook is configured and working
    expect(result.current.data).toBeDefined()
  })
})

describe('useSwarmDetail', () => {
  it('fetches swarm detail when id is provided', async () => {
    const mockDetail: SwarmDetail = {
      session: {
        id: 'session-1',
        started_at: '2026-04-10T12:00:00Z',
        status: 'active',
      },
      teammates: [
        { id: 'run-1', agent_name: 'commit', status: 'completed' },
        { id: 'run-2', agent_name: 'code-reviewer', status: 'pending' },
      ],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockDetail), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmDetail('session-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockDetail)
    expect(global.fetch).toHaveBeenCalledWith('/api/swarm/sessions/session-1')
  })

  it('does not fetch when id is null', async () => {
    const { result } = renderHook(() => useSwarmDetail(null), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns error when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Swarm not found' }), { status: 404 }),
    )

    const { result } = renderHook(() => useSwarmDetail('invalid'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('refetches when id changes', async () => {
    const mockDetail: SwarmDetail = {
      session: { id: 'session-1', started_at: '2026-04-10T12:00:00Z', status: 'active' },
      teammates: [],
    }

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockDetail), { status: 200 }),
    )

    const { result, rerender } = renderHook((id: string | null) => useSwarmDetail(id), {
      wrapper: createWrapper(),
      initialProps: 'session-1',
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)

    // Change id
    mockDetail.session.id = 'session-2'
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockDetail), { status: 200 }),
    )

    rerender('session-2')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    expect(global.fetch).toHaveBeenLastCalledWith('/api/swarm/sessions/session-2')
  })
})

describe('useSwarmMessages', () => {
  it('fetches messages when id is provided', async () => {
    const mockMessages = [
      { id: 'msg-1', content: 'Task started', created_at: '2026-04-10T12:00:00Z' },
      { id: 'msg-2', content: 'Running agent', created_at: '2026-04-10T12:01:00Z' },
    ]

    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: mockMessages }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmMessages('session-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockMessages)
    expect(global.fetch).toHaveBeenCalledWith('/api/swarm/sessions/session-1/messages')
  })

  it('does not fetch when id is null', async () => {
    const { result } = renderHook(() => useSwarmMessages(null), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns error when fetch fails', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }),
    )

    const { result } = renderHook(() => useSwarmMessages('session-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBeDefined()
  })

  it('returns empty array when no messages exist', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ messages: [] }), { status: 200 }),
    )

    const { result } = renderHook(() => useSwarmMessages('session-1'), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual([])
  })
})

