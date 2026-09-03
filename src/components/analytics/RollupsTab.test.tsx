import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { AgentRunsDailyRow, McpCallsDailyRow } from '../../types'

// jsdom doesn't implement ResizeObserver, which recharts' ResponsiveContainer needs.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

// ResponsiveContainer measures itself via getBoundingClientRect on mount, which
// jsdom reports as all-zero — that keeps recharts from ever rendering the chart's
// children, so the bar-fill assertions below would never find anything. Stub a
// non-zero size.
Element.prototype.getBoundingClientRect = () => ({
  width: 800, height: 300, top: 0, left: 0, bottom: 300, right: 800, x: 0, y: 0,
  toJSON() {},
})

vi.mock('../../lib/useChartColors', () => ({
  useChartColors: () => ({
    mint: '#00FFC2', mintDim: 'rgba(0,255,194,0.3)',
    amber: '#F59E0B', amberDim: 'rgba(245,158,11,0.3)',
    purple: '#A78BFA', blue: '#60A5FA', rose: '#FB7185',
    gray: '#6B7280', success: '#34D399', error: '#F87171',
    chart4: '#FBBF24', barTrack: '#1e293b',
  }),
}))

const useAgentRunsDaily = vi.fn()
const useMcpCallsDaily = vi.fn()
vi.mock('../../api/useCastData', () => ({
  useAgentRunsDaily: (...args: unknown[]) => useAgentRunsDaily(...args),
  useMcpCallsDaily: (...args: unknown[]) => useMcpCallsDaily(...args),
}))

import RollupsTab from './RollupsTab'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const completeRow: AgentRunsDailyRow = {
  day: '2026-09-01',
  runs: 100,
  cost_usd: 50,
  input_tokens: 1000,
  output_tokens: 500,
  duration_ms: 60000,
  avg_cost_per_run: 0.5, // API-computed SUM/SUM — naive client average would differ (see below)
  is_partial: false,
}

// A second completed day with a very different runs/cost ratio, so a naive
// client-side average of per-day cost_usd (or of the two avg_cost_per_run
// values) would NOT equal the latest day's own avg_cost_per_run (0.5).
const earlierRow: AgentRunsDailyRow = {
  day: '2026-08-31',
  runs: 10,
  cost_usd: 200,
  input_tokens: 500,
  output_tokens: 200,
  duration_ms: 30000,
  avg_cost_per_run: 20,
  is_partial: false,
}

const partialRow: AgentRunsDailyRow = {
  day: '2026-09-02',
  runs: 3,
  cost_usd: 0.75,
  input_tokens: 100,
  output_tokens: 50,
  duration_ms: 5000,
  avg_cost_per_run: 0.25,
  is_partial: true,
}

const mcpRows: McpCallsDailyRow[] = [
  { day: '2026-09-01', mcp_server: 'neon', is_cloud_bound: 1, calls: 12, result_bytes: 4096, is_partial: false },
]

describe('RollupsTab', () => {
  it('renders a loading skeleton', () => {
    useAgentRunsDaily.mockReturnValue({ data: undefined, isLoading: true })
    useMcpCallsDaily.mockReturnValue({ data: undefined, isLoading: true })

    render(<Wrapper><RollupsTab /></Wrapper>)

    expect(screen.getAllByTestId('rollups-skeleton').length).toBeGreaterThan(0)
  })

  it('renders an empty state when no rollup rows exist', () => {
    useAgentRunsDaily.mockReturnValue({ data: [], isLoading: false })
    useMcpCallsDaily.mockReturnValue({ data: [], isLoading: false })

    render(<Wrapper><RollupsTab /></Wrapper>)

    expect(screen.getByText(/no rollup data found/i)).toBeInTheDocument()
  })

  it('visually distinguishes the partial (today) row from completed days', () => {
    useAgentRunsDaily.mockReturnValue({ data: [earlierRow, completeRow, partialRow], isLoading: false })
    useMcpCallsDaily.mockReturnValue({ data: mcpRows, isLoading: false })

    render(<Wrapper><RollupsTab /></Wrapper>)

    const partialBars = screen.getAllByTestId('rollup-bar-partial')
    const completeBars = screen.getAllByTestId('rollup-bar-complete')
    expect(partialBars.length).toBe(1)
    expect(completeBars.length).toBe(2)
    // Different visual treatment: partial bar renders at reduced opacity.
    expect(partialBars[0]).toHaveAttribute('fill-opacity', '0.35')
    expect(completeBars[0]).toHaveAttribute('fill-opacity', '1')
    // A textual disclosure also calls out the partial day explicitly.
    expect(screen.getByText(/today.*faded|nightly rollup runs/i)).toBeInTheDocument()
  })

  it('reads the average-cost stat directly from the API avg_cost_per_run field, not a recomputed average', () => {
    useAgentRunsDaily.mockReturnValue({ data: [earlierRow, completeRow, partialRow], isLoading: false })
    useMcpCallsDaily.mockReturnValue({ data: mcpRows, isLoading: false })

    render(<Wrapper><RollupsTab /></Wrapper>)

    // Naive client averages would NOT equal 0.5:
    //   - mean of per-row avg_cost_per_run: (20 + 0.5) / 2 = 10.25
    //   - SUM(cost)/SUM(runs) across all rows incl. partial: 250.75/113 ≈ 2.22
    // The rendered value must match completeRow.avg_cost_per_run exactly (0.5 → "$0.5000").
    expect(screen.getByText('$0.5000')).toBeInTheDocument()
    expect(screen.queryByText('$10.2500')).not.toBeInTheDocument()
  })

  it('shows the rollup disclosure and total cost/runs stats', () => {
    useAgentRunsDaily.mockReturnValue({ data: [completeRow], isLoading: false })
    useMcpCallsDaily.mockReturnValue({ data: [], isLoading: false })

    render(<Wrapper><RollupsTab /></Wrapper>)

    expect(screen.getByText(/nightly cost rollup/i)).toBeInTheDocument()
    expect(screen.getByText('$50.00')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})
