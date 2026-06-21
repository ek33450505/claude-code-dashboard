import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReactNode } from 'react'

// Stub out every hook SystemView uses so we test render-without-crash
vi.mock('../api/useSystem', () => ({
  useSystemHealth: () => ({ data: null, isLoading: false }),
  useConfig: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useAgents', () => ({
  useAgents: () => ({ data: [], isLoading: false }),
  useAgent: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useKnowledge', () => ({
  useRules: () => ({ data: [], isLoading: false }),
  useSkills: () => ({ data: [], isLoading: false }),
  useCommands: () => ({ data: [], isLoading: false }),
}))
vi.mock('../api/useMemory', () => ({
  useAgentMemory: () => ({ data: [], isLoading: false }),
  useProjectMemory: () => ({ data: [], isLoading: false }),
}))
vi.mock('../api/usePlans', () => ({
  usePlans: () => ({ data: [], isLoading: false }),
  usePlan: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useCastData', () => ({
  useChainMap: () => ({ data: null, isLoading: false }),
  usePolicies: () => ({ data: null, isLoading: false }),
  useModelPricing: () => ({ data: null, isLoading: false }),
}))
vi.mock('../api/useParryGuard', () => ({
  useParryGuard: () => ({ data: { events: [] }, isLoading: false }),
}))
vi.mock('../api/useAgentTruncations', () => ({
  useAgentTruncations: () => ({ data: { truncations: [] }, isLoading: false }),
}))
vi.mock('../api/useCostSummary', () => ({
  useCostSummary: () => ({ data: null, isLoading: false }),
}))
vi.mock('../components/StatCard', () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
  StatCardSkeleton: () => <div />,
}))
vi.mock('../components/CopyButton', () => ({
  default: () => <button>Copy</button>,
}))
// SqliteExplorerView is lazy-loaded — stub it
vi.mock('./SqliteExplorerView', () => ({
  default: () => <div>DB Explorer</div>,
}))

import SystemView from './SystemView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SystemView', () => {
  it('renders without crashing', () => {
    render(<SystemView />, { wrapper: Wrapper })
    // The "System" heading should appear in one of the tabs
    expect(screen.getByRole('heading', { name: /system/i })).toBeTruthy()
  })

  it('renders tab navigation', () => {
    render(<SystemView />, { wrapper: Wrapper })
    // Tabs expose the WAI-ARIA tablist pattern (role="tab" within a tablist)
    expect(screen.getByRole('tablist', { name: /system sections/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /agents/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /memory/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /plans/i })).toBeTruthy()
  })
})
