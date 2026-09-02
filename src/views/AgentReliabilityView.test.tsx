import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../api/useAgentHallucinations', () => ({
  useAgentHallucinations: () => ({ data: { entries: [], total: 0 }, isLoading: false }),
  useAgentHallucinationStats: () => ({ data: { total: 0, by_agent: [] }, isLoading: false }),
}))

vi.mock('../api/useCompletenessEvents', () => ({
  useCompletenessEvents: () => ({
    data: {
      entries: [
        { id: 1, agent: 'code-writer', severity: 'MEDIUM', snippet: 'test snippet', created_at: '2026-07-01T10:00:00Z' },
        { id: 2, agent: 'debugger',    severity: 'HIGH',   snippet: null,           created_at: '2026-07-01T10:00:00Z' },
      ],
      total: 2,
    },
    isLoading: false,
  }),
  useCompletenessEventsStats: () => ({ data: { total: 2, by_severity: {} }, isLoading: false }),
}))

vi.mock('../api/useAgentTruncations', () => ({
  useAgentTruncations: vi.fn(() => ({ data: { truncations: [], total: 0 }, isLoading: false })),
}))
vi.mock('../api/useAgentProtocolViolations', () => ({
  useAgentProtocolViolations: () => ({ data: { entries: [], total: 0 }, isLoading: false }),
}))
vi.mock('../api/useWorktreeAnomalies', () => ({
  useWorktreeAnomalies: vi.fn(() => ({ data: { anomalies: [], total: 0 }, isLoading: false })),
}))

vi.mock('../components/SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('../components/StatusPill', () => ({
  default: ({ status, label }: { status: string; label?: string }) => <span>{label ?? status}</span>,
}))
vi.mock('../components/Tabs', () => ({
  default: ({ tabs, activeTab, onChange, children }: { tabs: { id: string; label: string }[]; activeTab: string; onChange: (id: string) => void; children: ReactNode }) => (
    <div>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} aria-pressed={activeTab === t.id}>
          {t.label}
        </button>
      ))}
      <div>{children}</div>
    </div>
  ),
}))

import AgentReliabilityView from './AgentReliabilityView'
import { useWorktreeAnomalies } from '../api/useWorktreeAnomalies'
import { useAgentTruncations } from '../api/useAgentTruncations'

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('AgentReliabilityView — SeverityBadge case normalization', () => {
  it('renders amber badge for uppercase MEDIUM severity', async () => {
    render(<Wrapper><AgentReliabilityView /></Wrapper>)

    // Navigate to the Completeness tab
    const completenessTab = screen.getByRole('button', { name: /completeness/i })
    await userEvent.click(completenessTab)

    // The MEDIUM badge should render with amber styling (not fall through to default)
    const mediumBadge = screen.getByText('MEDIUM')
    expect(mediumBadge).toHaveClass('text-amber-400')
  })

  it('renders orange badge for uppercase HIGH severity', async () => {
    render(<Wrapper><AgentReliabilityView /></Wrapper>)

    const completenessTab = screen.getByRole('button', { name: /completeness/i })
    await userEvent.click(completenessTab)

    const highBadge = screen.getByText('HIGH')
    expect(highBadge).toHaveClass('text-orange-400')
  })
})

describe('AgentReliabilityView — Worktree Anomalies tab', () => {
  it('shows total stat (not page count) and renders each anomaly row', async () => {
    vi.mocked(useWorktreeAnomalies).mockReturnValue({
      data: {
        anomalies: [
          {
            id: 1,
            agent_id: 'code-writer',
            worktree_path: '/tmp/wt-alpha',
            detected_at: '2026-07-01T10:00:00Z',
            repo_root: null,
            state: 'stale',
            reason: 'branch not merged',
          },
          {
            id: 2,
            agent_id: 'debugger',
            worktree_path: '/tmp/wt-beta',
            detected_at: '2026-07-01T11:00:00Z',
            repo_root: null,
            state: 'orphaned',
            reason: null,
          },
        ],
        total: 5,
      },
      isLoading: false,
    } as ReturnType<typeof useWorktreeAnomalies>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)

    const worktreesTab = screen.getByRole('button', { name: /worktree anomalies/i })
    await userEvent.click(worktreesTab)

    // Stat card shows total (5), NOT the page length (2)
    expect(screen.getByText('5')).toBeInTheDocument()

    // Both anomaly rows render by agent_id
    expect(screen.getByText('code-writer')).toBeInTheDocument()
    expect(screen.getByText('debugger')).toBeInTheDocument()
  })
})

describe('AgentReliabilityView — Truncations tab partial-log badge', () => {
  it('shows "Partial log" for a row with a captured partial_work_log', async () => {
    vi.mocked(useAgentTruncations).mockReturnValue({
      data: {
        truncations: [
          {
            id: 1,
            session_id: 'sess-1',
            agent_type: 'backend-writer',
            agent_id: 'a1',
            last_line: 'writing file...',
            timestamp: '2026-07-01T10:00:00Z',
            char_count: 500,
            partial_work_log: 'Reads: foo.ts\nEdits: bar.ts',
          },
        ],
        total: 1,
      },
      isLoading: false,
    } as ReturnType<typeof useAgentTruncations>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)

    const truncationsTab = screen.getByRole('button', { name: /^truncations$/i })
    await userEvent.click(truncationsTab)

    expect(screen.getByText('Partial log')).toBeInTheDocument()
    expect(screen.queryByText('No partial log')).not.toBeInTheDocument()
  })

  it('shows "No partial log" for a row with a null partial_work_log', async () => {
    vi.mocked(useAgentTruncations).mockReturnValue({
      data: {
        truncations: [
          {
            id: 2,
            session_id: 'sess-2',
            agent_type: 'frontend-writer',
            agent_id: 'a2',
            last_line: 'now let me run',
            timestamp: '2026-07-01T11:00:00Z',
            char_count: 300,
            partial_work_log: null,
          },
        ],
        total: 1,
      },
      isLoading: false,
    } as ReturnType<typeof useAgentTruncations>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)

    const truncationsTab = screen.getByRole('button', { name: /^truncations$/i })
    await userEvent.click(truncationsTab)

    expect(screen.getByText('No partial log')).toBeInTheDocument()
    expect(screen.queryByText('Partial log')).not.toBeInTheDocument()
  })
})
