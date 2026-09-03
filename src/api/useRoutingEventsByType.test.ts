import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useRoutingEventsByType } from './useRoutingEventsByType'

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useRoutingEventsByType', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Regression test for the invalidation-namespace bug: useDbChangeInvalidation
  // invalidates the whole ['routing'] tree on db_change_routing_event. If this
  // hook's query key isn't nested under ['routing', ...], that invalidation
  // silently misses it and it falls back to 10s polling only.
  it('refetches when the ["routing"] tree is invalidated', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })
    const { queryClient, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useRoutingEventsByType({ event_type: 'user_prompt_submit', limit: 200 }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['routing'] })
    })

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })
})
