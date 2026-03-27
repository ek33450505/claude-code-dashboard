import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import {
  useCastdStatus,
  useCastdLogs,
  useCastdStart,
  useCastdStop,
} from './useCastdControl'
import type { CastdStatus, CastdLogs } from './useCastdControl'

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

const MOCK_STATUS: CastdStatus = { running: true, pid: 1234, queueDepth: 3 }
const STOPPED_STATUS: CastdStatus = { running: false, pid: null, queueDepth: 0 }
const MOCK_LOGS: CastdLogs = { lines: ['[INFO] castd started', '[INFO] processing task-42'] }
const EMPTY_LOGS: CastdLogs = { lines: [] }

// ─── useCastdStatus ───────────────────────────────────────────────────────────

describe('useCastdStatus', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_STATUS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/castd/status', async () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/castd/status')
  })

  it('returns running status with pid and queueDepth on success', async () => {
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.running).toBe(true)
    expect(data.pid).toBe(1234)
    expect(data.queueDepth).toBe(3)
  })

  it('returns stopped status when daemon is not running', async () => {
    global.fetch = makeFetchOk(STOPPED_STATUS)
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.running).toBe(false)
    expect(result.current.data!.pid).toBeNull()
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useCastdStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })
})

// ─── useCastdLogs ─────────────────────────────────────────────────────────────

describe('useCastdLogs', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_LOGS)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useCastdLogs(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
  })

  it('fetches from /api/castd/logs', async () => {
    const { result } = renderHook(() => useCastdLogs(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/castd/logs')
  })

  it('returns log lines array on success', async () => {
    const { result } = renderHook(() => useCastdLogs(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.lines).toHaveLength(2)
    expect(result.current.data!.lines[0]).toContain('castd started')
  })

  it('returns empty lines array when no logs exist', async () => {
    global.fetch = makeFetchOk(EMPTY_LOGS)
    const { result } = renderHook(() => useCastdLogs(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.lines).toHaveLength(0)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useCastdLogs(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useCastdStart ────────────────────────────────────────────────────────────

describe('useCastdStart', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST to /api/castd/start', async () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStart(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/castd/start', { method: 'POST' })
  })

  it('mutation is idle before being called', () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStart(), { wrapper: makeWrapper() })
    expect(result.current.isIdle).toBe(true)
  })

  it('returns success:true when daemon starts successfully', async () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStart(), { wrapper: makeWrapper() })

    let response: { success: boolean; error?: string } | undefined
    await act(async () => {
      response = await result.current.mutateAsync()
    })

    expect(response?.success).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('returns success:false with error message when daemon fails to start', async () => {
    global.fetch = makeFetchOk({ success: false, error: 'already running' })
    const { result } = renderHook(() => useCastdStart(), { wrapper: makeWrapper() })

    let response: { success: boolean; error?: string } | undefined
    await act(async () => {
      response = await result.current.mutateAsync()
    })

    expect(response?.success).toBe(false)
    expect(response?.error).toBe('already running')
  })
})

// ─── useCastdStop ─────────────────────────────────────────────────────────────

describe('useCastdStop', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST to /api/castd/stop', async () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStop(), { wrapper: makeWrapper() })

    await act(async () => {
      await result.current.mutateAsync()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/castd/stop', { method: 'POST' })
  })

  it('mutation is idle before being called', () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStop(), { wrapper: makeWrapper() })
    expect(result.current.isIdle).toBe(true)
  })

  it('resolves successfully when the server confirms stop', async () => {
    global.fetch = makeFetchOk({ success: true })
    const { result } = renderHook(() => useCastdStop(), { wrapper: makeWrapper() })

    let response: { success: boolean; error?: string } | undefined
    await act(async () => {
      response = await result.current.mutateAsync()
    })

    expect(response?.success).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('returns success:false with error when daemon was not running', async () => {
    global.fetch = makeFetchOk({ success: false, error: 'not running' })
    const { result } = renderHook(() => useCastdStop(), { wrapper: makeWrapper() })

    let response: { success: boolean; error?: string } | undefined
    await act(async () => {
      response = await result.current.mutateAsync()
    })

    expect(response?.success).toBe(false)
    expect(response?.error).toBe('not running')
  })
})
