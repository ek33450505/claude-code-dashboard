import { DollarSign } from 'lucide-react'
import { useCostSummary } from '../../api/useCostSummary'

// TODO: cost-summary (above) is the preferred source; remove this section in a future pass

function fmtCost(usd: number): string {
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return String(n)
}

export default function CostSummaryCard() {
  const { data, isLoading, isError } = useCostSummary({ days: 30, top: 5 })

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded mb-4" />
        <div className="h-8 w-24 bg-[var(--bg-tertiary)] rounded mb-6" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 bg-[var(--bg-tertiary)] rounded" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">Cost Summary (30d)</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">No cost data available.</p>
      </div>
    )
  }

  const { totals, byModel, topSessions } = data

  return (
    <div className="bento-card p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cost Summary (30d)</h2>
        </div>
        <span className="text-2xl font-bold text-[var(--accent)] tabular-nums">
          {fmtCost(totals.costUsd)}
        </span>
      </div>

      {/* Model breakdown table */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">By Model</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Cost by model">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-4">Model</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Input Tokens</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Output Tokens</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)]">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {byModel.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-center text-[var(--text-muted)]">No model data</td>
                </tr>
              ) : byModel.map(entry => (
                <tr key={entry.model} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-4 font-mono text-[var(--text-primary)] truncate max-w-[160px]" title={entry.model}>
                    {entry.model}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--text-secondary)]">{formatTokens(entry.inputTokens)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--text-secondary)]">{formatTokens(entry.outputTokens)}</td>
                  <td className="py-2 text-right tabular-nums text-[var(--accent)]">{fmtCost(entry.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 sessions */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Top Sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Top sessions by cost">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left pb-2 font-medium text-[var(--text-muted)] pr-4">Session ID</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)] pr-4">Cost</th>
                <th className="text-right pb-2 font-medium text-[var(--text-muted)]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {topSessions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-center text-[var(--text-muted)]">No session data</td>
                </tr>
              ) : topSessions.slice(0, 5).map(session => (
                <tr key={session.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-4 font-mono text-[var(--text-primary)]">
                    {session.id.slice(0, 12)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--accent)]">
                    {fmtCost(session.costUsd)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {session.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
