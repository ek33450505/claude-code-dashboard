import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useControlStatus } from './useControlEnabled'

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useControlStatus', () => {
  afterEach(() => vi.restoreAllMocks())

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: true, tokenConfigured: false }),
    })
  })

  it('fetches from /api/config/control', async () => {
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/config/control')
  })

  it('passes through an already-boolean response unchanged', async () => {
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ enabled: true, tokenConfigured: false })
  })

  it('coerces non-boolean response values to strict booleans', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: 1, tokenConfigured: 0 }),
    })
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // toEqual distinguishes 1/0 from true/false (different types), but assert
    // per-field with toBe too so the intent to require strict booleans is explicit.
    expect(result.current.data).toEqual({ enabled: true, tokenConfigured: false })
    expect(result.current.data?.enabled).toBe(true)
    expect(result.current.data?.tokenConfigured).toBe(false)
  })

  it('coerces a truthy non-boolean string to true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ enabled: 'yes', tokenConfigured: '' }),
    })
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.enabled).toBe(true)
    expect(result.current.data?.tokenConfigured).toBe(false)
  })

  it('errors when the fetch is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    const { result } = renderHook(() => useControlStatus(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
