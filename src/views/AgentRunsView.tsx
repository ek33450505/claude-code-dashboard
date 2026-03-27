import { useState, useMemo } from 'react'
import { Zap, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react'
import { useAgentRuns } from '../api/useAgentRuns'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  done: { bg: 'rgba(0,255,194,0.15)', text: '#00FFC2', label: 'Done' },
  done_with_concerns: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Concerns' },
  blocked: { bg: 'rgba(251,113,133,0.15)', text: '#FB7185', label: 'Blocked' },
  needs_context: { bg: 'rgba(96,165,250,0.15)', text: '#60A5FA', label: 'Needs Context' },
  running: { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA', label: 'Running' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: 'rgba(107,114,128,0.15)', text: '#6B7280', label: status }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

function StatCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="bento-card p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-[var(--accent-subtle)] shrink-0">
        <Icon className="w-4 h-4 text-[var(--accent)]" />
      </div>
      <div>
        <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
      </div>
    </div>
  )
}

function formatCost(usd: number) {
  if (!usd) return '$0.00'
  if (usd < 0.001) return `$${usd.toFixed(5)}`
  return `$${usd.toFixed(3)}`
}

type SortKey = 'started_at' | 'agent' | 'status' | 'cost_usd'

export default function AgentRunsView() {
  const [agentFilter, setAgentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('started_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const params = useMemo(() => ({
    limit: 100,
    ...(agentFilter ? { agent: agentFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }), [agentFilter, statusFilter])

  const { data, isLoading, error } = useAgentRuns(params)

  const agentList = useMemo(() => {
    if (!data) return []
    return Object.keys(data.stats.byAgent).sort()
  }, [data])

  const statusList = useMemo(() => {
    if (!data) return []
    return Object.keys(data.stats.byStatus).sort()
  }, [data])

  const sortedRuns = useMemo(() => {
    if (!data?.runs) return []
    return [...data.runs].sort((a, b) => {
      let aVal = a[sortKey] ?? ''
      let bVal = b[sortKey] ?? ''
      if (sortKey === 'cost_usd') {
        return sortDir === 'asc' ? (a.cost_usd - b.cost_usd) : (b.cost_usd - a.cost_usd)
      }
      aVal = String(aVal)
      bVal = String(bVal)
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [data, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const mostUsedAgent = useMemo(() => {
    if (!data?.stats.byAgent) return 'N/A'
    const entries = Object.entries(data.stats.byAgent)
    if (!entries.length) return 'N/A'
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  }, [data])

  const errorRate = useMemo(() => {
    if (!data?.stats) return '0%'
    const total = data.stats.totalRuns
    const errors = (data.stats.byStatus['blocked'] ?? 0) + (data.stats.byStatus['error'] ?? 0)
    return total > 0 ? `${Math.round((errors / total) * 100)}%` : '0%'
  }, [data])

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bento-card p-5 h-20 animate-pulse bg-[var(--bg-secondary)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bento-card p-6 text-[var(--error)]">Failed to load agent runs.</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Agent Runs</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Last 100 agent executions from cast.db</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Total Runs" value={String(data?.stats.totalRuns ?? 0)} />
        <StatCard icon={DollarSign} label="Total Cost" value={formatCost(data?.stats.totalCostUsd ?? 0)} />
        <StatCard icon={CheckCircle} label="Top Agent" value={mostUsedAgent} />
        <StatCard icon={AlertCircle} label="Error Rate" value={errorRate} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">All agents</option>
          {agentList.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">All statuses</option>
          {statusList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {sortedRuns.length === 0 ? (
        <div className="bento-card p-8 text-center text-[var(--text-muted)]">
          <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No agent runs found</div>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)] text-[var(--text-muted)]">
                  {[
                    { key: 'started_at' as SortKey, label: 'Started' },
                    { key: 'agent' as SortKey, label: 'Agent' },
                    { key: 'status' as SortKey, label: 'Status' },
                    { key: 'cost_usd' as SortKey, label: 'Cost' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-medium text-xs cursor-pointer hover:text-[var(--text-primary)] select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-xs">Summary</th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.map(run => (
                  <tr key={run.id} className="border-b border-[var(--glass-border)] hover:bg-[var(--accent-subtle)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--text-muted)] font-mono text-xs whitespace-nowrap">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)] font-medium">{run.agent}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)] tabular-nums">{formatCost(run.cost_usd)}</td>
                    <td className="px-4 py-2.5 text-[var(--text-muted)] max-w-xs truncate" title={run.task_summary ?? ''}>
                      {run.task_summary ? run.task_summary.slice(0, 80) : '—'}
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
