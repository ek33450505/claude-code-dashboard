import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ─── Minimal stubs for recharts and lucide-react ─────────────────────────────
// AgentScorecard is inside AnalyticsView which imports recharts. We stub heavy
// chart deps so the component renders in a jsdom environment.

vi.mock('recharts', () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}))

vi.mock('lucide-react', () => ({
  Activity: () => null,
  Coins: () => null,
  TrendingUp: () => null,
  Clock: () => null,
  Zap: () => null,
  AlertTriangle: () => null,
  RefreshCw: () => null,
}))

// Stub useAnalytics with a minimal valid data object so AnalyticsView renders
// past its `if (!data) return null` guard and mounts the AgentScorecard subcomponent.
const MINIMAL_ANALYTICS = {
  totalSessions: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheCreationTokens: 0,
  totalCacheReadTokens: 0,
  estimatedCostUSD: 0,
  avgSessionDurationMs: 0,
  avgTokensPerSession: 0,
  sessionsByDay: [],
  sessionsByProject: [],
  toolUsage: [],
  modelBreakdown: [],
}

vi.mock('../api/useAnalytics', () => ({
  useAnalytics: () => ({ data: MINIMAL_ANALYTICS, isLoading: false, error: null }),
}))

// We import the file-under-test AFTER mocks are set up
import AnalyticsView from './AnalyticsView'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError(status = 503) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: 'Service unavailable' }),
  })
}

function makeFetchNetworkError() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AgentScorecard — F3 res.ok guard', () => {
  beforeEach(() => {
    // Default: successful fetch returning empty agents list
    global.fetch = makeFetchOk({ agents: [] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders "No agent runs" message when agents array is empty', async () => {
    global.fetch = makeFetchOk({ agents: [] })
    render(<AnalyticsView />)
    await waitFor(() => {
      expect(screen.getByText(/No agent runs in cast\.db yet/i)).toBeTruthy()
    })
  })

  it('renders agent data table when agents are returned', async () => {
    global.fetch = makeFetchOk({
      agents: [
        { name: 'code-writer', runs: 10, success_rate: 0.9, blocked_count: 1, avg_cost_usd: 0.02 },
      ],
    })
    render(<AnalyticsView />)
    await waitFor(() => {
      expect(screen.getByText('code-writer')).toBeTruthy()
    })
  })

  it('renders error message when /api/analytics/profile returns 503', async () => {
    global.fetch = makeFetchError(503)
    render(<AnalyticsView />)
    await waitFor(() => {
      // Error state renders the error message text — not a crash
      expect(screen.getByText(/Analytics unavailable/i)).toBeTruthy()
    })
  })

  it('renders error message when /api/analytics/profile returns 500', async () => {
    global.fetch = makeFetchError(500)
    render(<AnalyticsView />)
    await waitFor(() => {
      expect(screen.getByText(/Analytics unavailable/i)).toBeTruthy()
    })
  })

  it('renders error message on network failure (fetch rejects)', async () => {
    global.fetch = makeFetchNetworkError()
    render(<AnalyticsView />)
    await waitFor(() => {
      // Should show fallback message, not crash
      expect(screen.getByText(/scorecard unavailable|Failed to fetch/i)).toBeTruthy()
    })
  })

  it('does NOT throw when response is not ok (no unhandled rejection)', async () => {
    global.fetch = makeFetchError(503)
    // If the component doesn't guard !res.ok, calling .json() on an error body
    // would resolve to the error JSON — this test ensures no exception propagates
    expect(() => render(<AnalyticsView />)).not.toThrow()
  })
})
