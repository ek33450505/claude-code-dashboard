import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { useAgentScorecard } from '../../api/useAgentProfile'
import { useChartColors } from '../../lib/useChartColors'

export default function AgentScorecard() {
  const { data, isLoading: loading, error } = useAgentScorecard()
  const agents = data?.agents ?? []
  const c = useChartColors()

  if (loading) {
    return (
      <div className="bento-card p-6 space-y-3">
        <div className="h-4 w-40 rounded bg-[var(--bg-secondary)] animate-pulse" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-[var(--bg-secondary)] animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return <div className="bento-card p-6 text-[var(--error)] text-sm">{error instanceof Error ? error.message : 'Failed to load'}</div>
  }

  if (!agents.length) {
    return (
      <div className="bento-card p-6 text-center text-[var(--text-muted)] text-sm">
        No agent runs in cast.db yet.
      </div>
    )
  }

  return (
    <div className="bento-card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Agent Scorecard</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Per-agent success rate, blocked count, and avg cost from cast.db</p>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="Agent scorecard table — per-agent runs, success rate, blocked count, and average cost">
        <table className="w-full text-sm min-w-[340px] md:min-w-[560px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Runs</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] min-w-[120px] md:min-w-[160px]">Success Rate</th>
              {/* Hidden on mobile — shown at md+ */}
              <th scope="col" className="hidden md:table-cell px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Blocked</th>
              <th scope="col" className="hidden md:table-cell px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Avg Cost</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => {
              const underperformer = a.success_rate < 70 && a.blocked_count > 5
              const barColor = a.success_rate >= 80 ? c.mint : a.success_rate >= 70 ? c.amber : c.rose
              const barPct = Math.max(0, Math.min(100, a.success_rate))
              return (
                <tr key={a.name} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-6 py-3 font-medium text-[var(--text-primary)]">
                    <div className="flex items-center gap-2">
                      {underperformer && (
                        <AlertTriangle
                          className="w-3.5 h-3.5 text-rose-400 shrink-0"
                          aria-label="Underperformer: below 70% success and over 5 blocked"
                        />
                      )}
                      <Link
                        to={`/analytics/agents/${encodeURIComponent(a.name)}`}
                        className="hover:text-[var(--accent)] transition-colors no-underline"
                      >
                        {a.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{a.runs}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-2 rounded-full bg-[var(--bg-secondary)] overflow-hidden min-w-[60px] md:min-w-[80px]"
                        role="progressbar"
                        aria-valuenow={barPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Success rate: ${a.success_rate}%`}
                      >
                        <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-xs tabular-nums" style={{ color: barColor }}>{a.success_rate}%</span>
                    </div>
                  </td>
                  {/* Hidden on mobile */}
                  <td className="hidden md:table-cell px-6 py-3 text-right tabular-nums" style={{ color: a.blocked_count > 5 ? c.rose : 'var(--text-secondary)' }}>
                    {a.blocked_count}
                  </td>
                  <td className="hidden md:table-cell px-6 py-3 text-right text-[var(--text-muted)] tabular-nums font-mono text-xs">
                    {a.avg_cost_usd > 0 ? `$${a.avg_cost_usd.toFixed(4)}` : '$0.0000'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)] flex items-center gap-1" aria-label="Legend: triangle icon indicates underperformer">
        <AlertTriangle className="w-3 h-3 text-rose-400" aria-hidden="true" />
        = underperformer (&lt;70% success AND &gt;5 blocked)
      </div>
    </div>
  )
}
