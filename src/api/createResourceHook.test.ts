import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { createResourceHook } from './createResourceHook'

// ─── Fetch mock helpers ──────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  })
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// Same as makeWrapper, but also exposes the underlying QueryClient so a test
// can inspect the options a query was actually registered with.
function makeWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('createResourceHook', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches the configured path with no params', async () => {
    global.fetch = makeFetchOk({ items: ['a', 'b'] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
    })
    const { result } = renderHook(() => useThing(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/things')
    expect(result.current.data).toEqual({ items: ['a', 'b'] })
  })

  it('serialises params into the query string and omits nullish values', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
    })
    const { result } = renderHook(
      () => useThing({ limit: 10, since: undefined, active: true }),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toBe('/api/things?limit=10&active=true')
    expect(url).not.toContain('since')
  })

  it('throws the single `API error <status>: <path>` dialect on a non-OK response', async () => {
    global.fetch = makeFetchError(503)
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
    })
    const { result } = renderHook(() => useThing(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('API error 503: /api/things')
  })

  it('applies `select` to unwrap the response', async () => {
    global.fetch = makeFetchOk({ events: [{ id: '1' }, { id: '2' }] })
    const useThing = createResourceHook<{ events: { id: string }[] }, { id: string }[]>({
      path: '/api/events',
      queryKey: ['events'],
      select: (data) => data.events,
    })
    const { result } = renderHook(() => useThing(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('passes through staleTime to the underlying query', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
      staleTime: 12_345,
    })
    const { result } = renderHook(() => useThing(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // With staleTime > 0, the query is not immediately stale after success.
    // A dropped staleTime (defaults to 0) would make this immediately true.
    expect(result.current.isStale).toBe(false)
  })

  it('passes through refetchInterval to the underlying query', async () => {
    // shouldAdvanceTime lets fake timers auto-progress in real time, so
    // testing-library's own internal polling (waitFor) keeps working while
    // we still get to fast-forward the refetchInterval below.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      global.fetch = makeFetchOk({ items: [] })
      const useThing = createResourceHook<{ items: string[] }>({
        path: '/api/things',
        queryKey: ['things'],
        refetchInterval: 6_789,
      })
      const { result } = renderHook(() => useThing(), { wrapper: makeWrapper() })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(global.fetch).toHaveBeenCalledTimes(1)

      await act(() => vi.advanceTimersByTimeAsync(6_789))
      expect(global.fetch).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes through refetchIntervalInBackground to the underlying query', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
      refetchIntervalInBackground: false,
    })
    const { queryClient, wrapper } = makeWrapperWithClient()
    const { result } = renderHook(() => useThing(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const query = queryClient.getQueryCache().find({ queryKey: ['things'] })
    // A dropped pass-through leaves this undefined rather than the
    // explicit `false` configured above.
    expect(query?.options.refetchIntervalInBackground).toBe(false)
  })

  // ─── path as a function ─────────────────────────────────────────────────

  it('fetches the resolved url when `path` is a function, without auto-appending params', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: (params) => `/api/things/${params?.id}?verbose=1`,
      queryKey: ['things'],
    })
    const { result } = renderHook(() => useThing({ id: 'abc' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // A regression that fell back to auto-appending params would produce
    // '/api/things/abc?verbose=1&id=abc'.
    expect(global.fetch).toHaveBeenCalledWith('/api/things/abc?verbose=1')
  })

  it('uses the resolved url (not the raw config value) in the error message when `path` is a function', async () => {
    global.fetch = makeFetchError(404)
    const useThing = createResourceHook<{ items: string[] }>({
      path: (params) => `/api/things/${params?.id}`,
      queryKey: ['things'],
    })
    const { result } = renderHook(() => useThing({ id: 'xyz' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('API error 404: /api/things/xyz')
  })

  // ─── enabled ─────────────────────────────────────────────────────────────

  it('does not pass `enabled` to useQuery when omitted, preserving the default', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
    })
    const { queryClient, wrapper } = makeWrapperWithClient()
    renderHook(() => useThing(), { wrapper })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const query = queryClient.getQueryCache().find({ queryKey: ['things'] })
    expect(query?.options.enabled).toBeUndefined()
  })

  it('respects a static `enabled: false`, never firing the query', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
      enabled: false,
    })
    renderHook(() => useThing(), { wrapper: makeWrapper() })
    // Give any accidental fetch a tick to fire.
    await act(() => Promise.resolve())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('evaluates a function `enabled` against the hook params', async () => {
    global.fetch = makeFetchOk({ items: [] })
    const useThing = createResourceHook<{ items: string[] }>({
      path: '/api/things',
      queryKey: ['things'],
      enabled: (params) => !!params?.id,
    })
    const { result: disabled } = renderHook(() => useThing({}), { wrapper: makeWrapper() })
    await act(() => Promise.resolve())
    expect(disabled.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()

    const { result: enabledResult } = renderHook(() => useThing({ id: 'a' }), { wrapper: makeWrapper() })
    await waitFor(() => expect(enabledResult.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
