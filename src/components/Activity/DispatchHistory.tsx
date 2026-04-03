import { useState, useMemo } from 'react'
import { useAgentRuns } from '../../api/useAgentRuns'
import { formatCost } from '../../utils/costEstimate'
import { timeAgo, formatDuration } from '../../utils/time'
import StatusPill from './StatusPill'
import ModelBadge from './ModelBadge'

const STATUS_OPTIONS = ['', 'running', 'DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT']

export default function DispatchHistory() {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterAgent, setFilterAgent] = useState('')

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data, isLoading } = useAgentRuns({
    since: today,
    limit: 100,
    status: filterStatus || undefined,
    agent: filterAgent || undefined,
  })

  const runs = data?.runs ?? []

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 focus:outline-none focus:border-[var(--accent)]/40"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter by agent…"
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="text-xs rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 focus:outline-none focus:border-[var(--accent)]/40 w-40"
        />
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
          {runs.length} dispatch{runs.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] py-4 text-center">No dispatches today</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--glass-border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Agent</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Status</th>
                <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Model</th>
                <th className="text-right py-2 px-3 text-[var(--text-muted)] font-medium">Cost</th>
                <th className="text-right py-2 px-3 text-[var(--text-muted)] font-medium">Duration</th>
                <th className="text-right py-2 px-3 text-[var(--text-muted)] font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const durationMs = run.ended_at && run.started_at
                  ? new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
                  : null
                return (
                  <tr
                    key={run.id}
                    className="border-b border-[var(--glass-border)]/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-[var(--text-primary)]">{run.agent}</td>
                    <td className="py-2 px-3"><StatusPill status={run.status} /></td>
                    <td className="py-2 px-3">{run.model ? <ModelBadge model={run.model} /> : <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {run.cost_usd != null ? formatCost(run.cost_usd) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-[var(--text-secondary)]">
                      {durationMs != null ? formatDuration(durationMs) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--text-muted)]">
                      {run.started_at ? timeAgo(run.started_at) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
