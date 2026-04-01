import { useState } from 'react'
import { ShieldCheck, GitBranch, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useQueryClient } from '@tanstack/react-query'
import { useQualityGates, useDispatchDecisions } from '../api/useQualityGates'
import type { QualityGateEntry, DispatchDecisionEntry } from '../api/useQualityGates'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTs(ts: string | null): string {
  if (!ts) return '—'
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function isToday(ts: string | null): boolean {
  if (!ts) return false
  try {
    const d = new Date(ts)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
  } catch {
    return false
  }
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Result badge ─────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: string | null }) {
  if (result === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
        pass
      </span>
    )
  }
  if (result === 'block') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400">
        <XCircle className="w-3 h-3" aria-hidden="true" />
        block
      </span>
    )
  }
  if (result === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        warn
      </span>
    )
  }
  return <span className="text-[var(--text-muted)] text-xs">{result ?? '—'}</span>
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bento-card p-5">
      <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
      {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
    </div>
  )
}

// ── Tooltip style ─────────────────────────────────────────────────────────────

const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

// ── Quality Gates tab ─────────────────────────────────────────────────────────

function QualityGatesTab() {
  const { data, isLoading, error } = useQualityGates()
  const gates: QualityGateEntry[] = data?.gates ?? []

  const todayGates = gates.filter(g => isToday(g.created_at))
  const passCount = todayGates.filter(g => g.gate_result === 'pass').length
  const blockCount = todayGates.filter(g => g.gate_result === 'block').length
  const passRate = todayGates.length > 0
    ? Math.round((passCount / todayGates.length) * 100)
    : null

  if (isLoading) {
    return <div className="p-8 text-[var(--text-muted)] text-sm">Loading quality gates…</div>
  }

  if (error) {
    return (
      <div className="p-8 text-rose-400 text-sm">
        Failed to load quality gates. Is the dashboard server running?
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Gates fired today" value={todayGates.length} />
        <StatCard
          label="Pass rate (today)"
          value={passRate != null ? `${passRate}%` : '—'}
          sub={passRate != null ? `${passCount} pass / ${blockCount} block` : undefined}
        />
        <StatCard label="Blocks today" value={blockCount} />
      </div>

      {/* Table */}
      {gates.length === 0 ? (
        <div className="bento-card p-8 text-center text-[var(--text-muted)] text-sm">
          No quality gate events recorded yet.
          <div className="mt-2 text-xs text-[var(--text-muted)]/60">
            Events appear here after code-review, commit, or teammate-idle hooks fire.
          </div>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Gate Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Agent</th>
                  <th className="px-4 py-3 text-left font-semibold">Result</th>
                  <th className="px-4 py-3 text-left font-semibold">Feedback</th>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => (
                  <tr
                    key={g.id}
                    className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                      {g.gate_type ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {g.agent ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ResultBadge result={g.gate_result} />
                    </td>
                    <td
                      className="px-4 py-3 text-[var(--text-muted)] text-xs max-w-xs"
                      title={g.feedback ?? undefined}
                    >
                      {truncate(g.feedback, 80)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
                      {formatTs(g.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dispatch Decisions tab ────────────────────────────────────────────────────

function buildAgentCounts(decisions: DispatchDecisionEntry[]) {
  const counts: Record<string, number> = {}
  for (const d of decisions) {
    const agent = d.chosen_agent ?? 'unknown'
    counts[agent] = (counts[agent] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([agent, count]) => ({ agent, count }))
}

function DispatchDecisionsTab() {
  const { data, isLoading, error } = useDispatchDecisions()
  const decisions: DispatchDecisionEntry[] = data?.decisions ?? []

  const todayDecisions = decisions.filter(d => isToday(d.created_at))
  const uniqueAgents = new Set(decisions.map(d => d.chosen_agent).filter(Boolean)).size
  const agentCounts = buildAgentCounts(decisions)
  const topAgent = agentCounts[0]?.agent ?? '—'

  if (isLoading) {
    return <div className="p-8 text-[var(--text-muted)] text-sm">Loading dispatch decisions…</div>
  }

  if (error) {
    return (
      <div className="p-8 text-rose-400 text-sm">
        Failed to load dispatch decisions. Is the dashboard server running?
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Dispatches today" value={todayDecisions.length} />
        <StatCard label="Unique agents used" value={uniqueAgents} />
        <StatCard label="Most-used agent" value={topAgent} sub={agentCounts[0] ? `${agentCounts[0].count} dispatches` : undefined} />
      </div>

      {/* Agent usage chart */}
      {agentCounts.length > 0 && (
        <div className="bento-card p-5">
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Dispatch count by agent
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentCounts} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="agent"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'rgba(0,255,194,0.05)' }}
              />
              <Bar dataKey="count" fill="#00FFC2" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      {decisions.length === 0 ? (
        <div className="bento-card p-8 text-center text-[var(--text-muted)] text-sm">
          No dispatch decisions recorded yet.
          <div className="mt-2 text-xs text-[var(--text-muted)]/60">
            Events appear here when agents are dispatched via the Agent tool.
          </div>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Agent</th>
                  <th className="px-4 py-3 text-left font-semibold">Model</th>
                  <th className="px-4 py-3 text-left font-semibold">Effort</th>
                  <th className="px-4 py-3 text-left font-semibold">Prompt</th>
                  <th className="px-4 py-3 text-left font-semibold">Wave</th>
                  <th className="px-4 py-3 text-left font-semibold">Time</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                      {d.chosen_agent ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                      {d.model ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.effort ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)]">
                          {d.effort}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-[var(--text-muted)] text-xs max-w-xs"
                      title={d.prompt_snippet ?? undefined}
                    >
                      {truncate(d.prompt_snippet, 60)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs font-mono">
                      {d.wave_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] text-xs whitespace-nowrap">
                      {formatTs(d.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

type Tab = 'gates' | 'decisions'

export default function QualityGatesView() {
  const [tab, setTab] = useState<Tab>('gates')
  const queryClient = useQueryClient()

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['quality-gates'] })
    queryClient.invalidateQueries({ queryKey: ['dispatch-decisions'] })
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
            <ShieldCheck className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Quality Gates</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Decision audit — gate results and agent dispatch history from cast.db
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          aria-label="Refresh data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] w-fit">
        <button
          onClick={() => setTab('gates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'gates'
              ? 'bg-[var(--accent)] text-[#070A0F] shadow-md shadow-[#00FFC2]/20'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
          Quality Gates
        </button>
        <button
          onClick={() => setTab('decisions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'decisions'
              ? 'bg-[var(--accent)] text-[#070A0F] shadow-md shadow-[#00FFC2]/20'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <GitBranch className="w-4 h-4" aria-hidden="true" />
          Dispatch Decisions
        </button>
      </div>

      {/* Tab content */}
      {tab === 'gates' ? <QualityGatesTab /> : <DispatchDecisionsTab />}
    </div>
  )
}
