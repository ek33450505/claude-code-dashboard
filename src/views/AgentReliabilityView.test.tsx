import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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

vi.mock('../api/useCastData', () => ({
  useAckEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useProvenanceChain: vi.fn(() => ({ data: [], isLoading: false })),
  useCommitProvenance: vi.fn(() => ({ data: [], isLoading: false })),
  useAttestations: vi.fn(() => ({ data: [], isLoading: false })),
}))

vi.mock('../components/SectionHeader', () => ({
  default: ({ title }: { title: string }) => <div>{title}</div>,
}))
vi.mock('../components/StatusPill', () => ({
  default: ({ status, label, tone }: { status: string; label?: string; tone?: string }) => (
    <span data-tone={tone}>{label ?? status}</span>
  ),
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
import { useAckEvents, useProvenanceChain, useCommitProvenance, useAttestations } from '../api/useCastData'

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

describe('AgentReliabilityView — Hatches tab', () => {
  it('shows a table while loading', async () => {
    vi.mocked(useAckEvents).mockReturnValue({ data: [], isLoading: true } as ReturnType<typeof useAckEvents>)
    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^hatches$/i }))
    expect(screen.getByRole('table', { name: /escape hatch uses/i })).toBeInTheDocument()
  })

  it('shows empty state when there are no hatch uses', async () => {
    vi.mocked(useAckEvents).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof useAckEvents>)
    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^hatches$/i }))
    expect(screen.getByText('No hatch uses recorded')).toBeInTheDocument()
  })

  it('filters cap-sentinel rows out of the main table and renders a suppression notice instead', async () => {
    vi.mocked(useAckEvents).mockReturnValue({
      data: [
        {
          id: '1', variable: 'CAST_COMMIT_AGENT', value: '1', has_reason: 1,
          script: null, git_sha: 'abcdef1234', session_id: 'sess-abcdef12', repo: null,
          created_at: '2026-08-01T00:00:01Z', is_cap_sentinel: false,
        },
        {
          id: '2', variable: 'CAST_HATCH_RECORD_CAP', value: '3', has_reason: 0,
          script: null, git_sha: null, session_id: null, repo: null,
          created_at: '2026-08-01T00:00:00Z', is_cap_sentinel: true,
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useAckEvents>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^hatches$/i }))

    // The normal row renders in the table
    expect(screen.getByText('CAST_COMMIT_AGENT')).toBeInTheDocument()
    // The cap-sentinel row is NOT rendered as a normal hatch row
    expect(screen.queryByText('CAST_HATCH_RECORD_CAP')).not.toBeInTheDocument()
    // A distinct suppression notice is rendered instead, citing the count from `value`
    expect(screen.getByRole('status')).toHaveTextContent(/3 suppressed/i)
  })

  it('does not render a bare "1" hatch marker as if it were a meaningful reason', async () => {
    vi.mocked(useAckEvents).mockReturnValue({
      data: [
        {
          id: '1', variable: 'CAST_PUSH_OK', value: '1', has_reason: 0,
          script: null, git_sha: null, session_id: null, repo: null,
          created_at: '2026-08-01T00:00:01Z', is_cap_sentinel: false,
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useAckEvents>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^hatches$/i }))

    const row = screen.getByText('CAST_PUSH_OK').closest('tr')
    expect(row).not.toBeNull()
    const [, reasonCell] = within(row!).getAllByRole('cell')
    expect(reasonCell).toHaveTextContent('—')
  })
})

describe('AgentReliabilityView — Provenance tab', () => {
  it('renders an unverifiable provenance row with a neutral badge, never a danger one', async () => {
    vi.mocked(useProvenanceChain).mockReturnValue({
      data: [
        {
          seq: 1, session_id: 'sess-unverifiable', prev_hash: null, session_digest: 'digest1',
          chain_hash: 'hashunverifiable', created_at: '2026-08-01T00:00:00Z', receipt_json: null,
          verification_state: 'unverifiable',
        },
        {
          seq: 2, session_id: 'sess-verified', prev_hash: 'hashunverifiable', session_digest: 'digest2',
          chain_hash: 'hashverified', created_at: '2026-08-02T00:00:00Z', receipt_json: '{"ok":true}',
          verification_state: 'verified',
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useProvenanceChain>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^provenance$/i }))

    const unverifiableBadge = screen.getByText('Unverifiable')
    expect(unverifiableBadge).toHaveAttribute('data-tone', 'neutral')
    expect(unverifiableBadge).not.toHaveAttribute('data-tone', 'danger')
    expect(screen.getByText('Verified')).toHaveAttribute('data-tone', 'success')
  })

  it('renders commit provenance and flags attestations with false_done', async () => {
    vi.mocked(useCommitProvenance).mockReturnValue({
      data: [
        { sha: 'deadbeef1234', session_id: 'sess-1', agent: 'backend-writer', branch: 'main', repo: 'dashboard', recorded_at: '2026-08-01T00:00:00Z' },
      ],
      isLoading: false,
    } as ReturnType<typeof useCommitProvenance>)
    vi.mocked(useAttestations).mockReturnValue({
      data: [
        { id: '1', agent_key: 'backend-writer', false_done: 1, payload: '{"claim":"done"}', created_at: '2026-08-01T00:00:00Z' },
      ],
      isLoading: false,
    } as ReturnType<typeof useAttestations>)

    render(<Wrapper><AgentReliabilityView /></Wrapper>)
    await userEvent.click(screen.getByRole('button', { name: /^provenance$/i }))

    const commitsTable = screen.getByRole('table', { name: /commit provenance/i })
    expect(within(commitsTable).getByText('backend-writer')).toBeInTheDocument()

    const attestationsTable = screen.getByRole('table', { name: /attestations/i })
    const attestationRow = within(attestationsTable).getByText('backend-writer').closest('tr')
    expect(attestationRow).not.toBeNull()
    expect(within(attestationRow!).getByText('False DONE')).toBeInTheDocument()
  })
})
