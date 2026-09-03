import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useOutputs } from './useOutputs'

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useOutputs', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Regression test: before the `enabled` guard, a missing category type-checked
  // and fell through to path's template-literal interpolation, issuing a fetch
  // to the literal url '/api/outputs/undefined'.
  it('does not fetch when called with no category', async () => {
    global.fetch = vi.fn()
    renderHook(() => useOutputs(), { wrapper: makeWrapper() })
    // Give any accidental fetch a tick to fire.
    await act(() => Promise.resolve())
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not fetch when category is explicitly undefined', async () => {
    global.fetch = vi.fn()
    const { result } = renderHook(() => useOutputs({ category: undefined }), {
      wrapper: makeWrapper(),
    })
    await act(() => Promise.resolve())
    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches the category-scoped url when a valid category is passed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })
    const { result } = renderHook(() => useOutputs({ category: 'briefings' }), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/outputs/briefings')
  })
})
