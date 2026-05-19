import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// HooksView defines useHooks inline using useQuery — mock fetch at the module boundary
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import HooksView from './HooksView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
})

const MOCK_HOOKS = [
  { event: 'PreToolUse', type: 'command', command: 'bash scripts/pre-tool.sh', matcher: 'Bash' },
  { event: 'PostToolUse', type: 'command', command: 'bash scripts/post-tool.sh' },
  { event: 'PostToolUse', type: 'command', command: 'bash scripts/audit.sh', timeout: 5000 },
]

describe('HooksView', () => {
  it('renders grouped hook list when data is present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HOOKS,
    })

    render(<HooksView />, { wrapper: Wrapper })

    // Heading always renders
    expect(screen.getByText('Hooks')).toBeTruthy()

    // Wait for data to load
    expect(await screen.findByText('PreToolUse')).toBeTruthy()
    expect(screen.getByText('PostToolUse')).toBeTruthy()
    expect(screen.getByText('bash scripts/pre-tool.sh')).toBeTruthy()
    expect(screen.getByText('bash scripts/post-tool.sh')).toBeTruthy()
  })

  it('renders hook count in header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HOOKS,
    })

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('3 hooks')).toBeTruthy()
  })

  it('shows loading skeleton before data arrives', () => {
    // Never resolve — stays in loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}))

    render(<HooksView />, { wrapper: Wrapper })

    // Header renders even during load
    expect(screen.getByText('Hooks')).toBeTruthy()
    // Hook list not yet present
    expect(screen.queryByText('PreToolUse')).toBeNull()
  })

  it('shows empty state when no hooks are configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('No hooks configured')).toBeTruthy()
  })

  it('shows error state when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    render(<HooksView />, { wrapper: Wrapper })

    expect(await screen.findByText('Failed to load hooks.')).toBeTruthy()
  })

  it('groups hooks under their event name', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_HOOKS,
    })

    render(<HooksView />, { wrapper: Wrapper })

    await screen.findByText('PreToolUse')

    // PostToolUse section should show count badge of 2
    const sections = screen.getAllByRole('region')
    expect(sections.length).toBe(2) // PreToolUse + PostToolUse
  })
})
