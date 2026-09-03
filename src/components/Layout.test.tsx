import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import fs from 'node:fs'
import path from 'node:path'
import Layout, { ROUTE_TITLES } from './Layout'

// Layout pulls in Sidebar/CommandPalette (nav chrome, live-event polling) and
// several data/UI hooks that are irrelevant to the document-title behavior
// under test — stub them to passthroughs/no-ops so only routing+title logic runs.
vi.mock('./Sidebar', () => ({ default: () => <nav>Sidebar</nav> }))
vi.mock('./CommandPalette', () => ({ default: () => null }))
vi.mock('../api/useBudgetStatus', () => ({ useBudgetStatus: () => ({ data: undefined }) }))
vi.mock('../api/useLive', () => ({ useLiveEvents: () => ({ connected: false }) }))
vi.mock('../lib/useModalA11y', () => ({ useModalA11y: () => ({ current: null }) }))
vi.mock('../state/themeState', () => ({ useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }) }))

function renderLayoutAt(pathname: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <Layout>
          <div>content</div>
        </Layout>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Layout document title (WCAG 2.4.2)', () => {
  it('sets a named title for a known route', () => {
    renderLayoutAt('/sessions')
    expect(document.title).toBe('Sessions · CAST Dashboard')
  })

  it('sets the Database title for /db', () => {
    // Regression: /db (SqliteExplorerView, App.tsx) had no ROUTE_TITLES entry
    // and silently fell back to the generic "Dashboard" title.
    renderLayoutAt('/db')
    expect(document.title).toBe('Database · CAST Dashboard')
  })

  it('falls back to the generic title for an unrecognized segment', () => {
    renderLayoutAt('/this-route-does-not-exist')
    expect(document.title).toBe('Dashboard · CAST Dashboard')
  })

  // Real gate, not a proxy: derive the actual route list from App.tsx (rather
  // than hardcoding a copy of it here) and assert every top-level route's
  // first path segment has a ROUTE_TITLES entry. A PASSING run means every
  // segment maps to something other than `undefined` — i.e. Object.keys
  // covers every derived segment. Before the `db` fix this FAILED because
  // 'db' (from App.tsx's `<Route path="/db" ...>`) was absent from the map;
  // see the mutation-test note in the PR description.
  it('has a ROUTE_TITLES entry for every top-level route in App.tsx', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8')
    const routePaths = [...appSource.matchAll(/<Route\s+(?:key=\{[^}]*\}\s+)?path="([^"]+)"/g)]
      .map(m => m[1])
      .filter(p => p !== '*') // exclude the 404 catch-all, which has no segment

    expect(routePaths.length).toBeGreaterThan(0) // sanity: the regex actually matched routes

    const segments = new Set(routePaths.map(p => p.split('/')[1] ?? ''))

    for (const seg of segments) {
      expect(Object.keys(ROUTE_TITLES)).toContain(seg)
    }
  })
})
