import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import App from './App'

// App renders Layout (Sidebar, CommandPalette, budget/live-event hooks) around
// every route — none of that is what's under test here, so stub it to a
// passthrough that just renders children.
vi.mock('./components/Layout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

// useDbChangeInvalidation opens a live SSE connection — irrelevant to routing.
vi.mock('./api/useDbChangeInvalidation', () => ({
  useDbChangeInvalidation: vi.fn(),
}))

// Stub every lazily-loaded view with a trivial marker so tests assert on
// *which* view rendered without pulling in each view's own data hooks.
vi.mock('./views/HomeView', () => ({ default: () => <div>HomeView</div> }))
vi.mock('./views/SessionsView', () => ({ default: () => <div>SessionsView</div> }))
vi.mock('./views/SessionDetailView', () => ({ default: () => <div>SessionDetailView</div> }))
vi.mock('./views/AnalyticsView', () => ({ default: () => <div>AnalyticsView</div> }))
vi.mock('./views/AnalyticsAgentDetailView', () => ({ default: () => <div>AnalyticsAgentDetailView</div> }))
vi.mock('./views/SystemView', () => ({ default: () => <div>SystemView</div> }))
vi.mock('./views/DocsView', () => ({ default: () => <div>DocsView</div> }))
vi.mock('./views/AgentsView', () => ({ default: () => <div>AgentsView</div> }))
vi.mock('./views/WorkLogView', () => ({ default: () => <div>WorkLogView</div> }))
vi.mock('./views/HookFailuresView', () => ({ default: () => <div>HookFailuresView</div> }))
vi.mock('./views/InjectionLogView', () => ({ default: () => <div>InjectionLogView</div> }))
vi.mock('./views/AgentReliabilityView', () => ({ default: () => <div>AgentReliabilityView</div> }))
vi.mock('./views/RoutinesView', () => ({ default: () => <div>RoutinesView</div> }))
vi.mock('./views/IncidentsView', () => ({ default: () => <div>IncidentsView</div> }))
vi.mock('./views/HooksView', () => ({ default: () => <div>HooksView</div> }))
vi.mock('./views/MemoryView', () => ({ default: () => <div>MemoryView</div> }))
vi.mock('./views/PlansView', () => ({ default: () => <div>PlansView</div> }))
vi.mock('./views/ExecutiveSummaryView', () => ({ default: () => <div>ExecutiveSummaryView</div> }))
vi.mock('./views/EvalRunsView', () => ({ default: () => <div>EvalRunsView</div> }))
vi.mock('./views/OutputsView', () => ({ default: () => <div>OutputsView</div> }))
vi.mock('./views/SqliteExplorerView', () => ({ default: () => <div>SqliteExplorerView</div> }))

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App routing', () => {
  describe('legacy redirects', () => {
    it('redirects /local-os/sqlite-explorer to /db (SqliteExplorerView)', async () => {
      renderAt('/local-os/sqlite-explorer')
      expect(await screen.findByText('SqliteExplorerView')).toBeInTheDocument()
    })

    it('redirects /local-os/token-spend to /analytics', async () => {
      renderAt('/local-os/token-spend')
      expect(await screen.findByText('AnalyticsView')).toBeInTheDocument()
    })

    it('redirects the /knowledge/* wildcard to /system', async () => {
      renderAt('/knowledge/some/nested/page')
      expect(await screen.findByText('SystemView')).toBeInTheDocument()
    })

    it('redirects the /agents/* wildcard to /agents', async () => {
      renderAt('/agents/some-agent')
      expect(await screen.findByText('AgentsView')).toBeInTheDocument()
    })

    it('redirects /swarm to / (HomeView)', async () => {
      renderAt('/swarm')
      expect(await screen.findByText('HomeView')).toBeInTheDocument()
    })
  })

  describe('promoted live view', () => {
    it('/db still renders SqliteExplorerView directly (not a redirect)', async () => {
      renderAt('/db')
      expect(await screen.findByText('SqliteExplorerView')).toBeInTheDocument()
    })
  })

  describe('404 catch-all', () => {
    it('renders the 404 page for an unknown path', async () => {
      renderAt('/this-path-does-not-exist')
      expect(await screen.findByText('404')).toBeInTheDocument()
      expect(screen.getByText('Page not found')).toBeInTheDocument()
    })
  })
})
