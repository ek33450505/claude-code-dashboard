import { useState, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Activity, CheckCircle2, TrendingUp, Clock, ChevronDown, ChevronRight, Timer } from 'lucide-react'
import type { DispatchEvent } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', label: 'completed' },
  started:   { bg: 'bg-blue-500/20',    text: 'text-blue-300',    label: 'started' },
  failed:    { bg: 'bg-red-500/20',     text: 'text-red-400',     label: 'failed' },
}

function getStatusStyle(status: string) {
  return STATUS_COLORS[status] ?? { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: status }
}

type FilterMode = 'all' | 'completed' | 'failed'

const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useDispatchEvents(limit = 500) {
  return useQuery<DispatchEvent[]>({
    queryKey: ['routing', 'events', limit],
    queryFn: async () => {
      const res = await fetch(`/api/routing/events?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch dispatch events')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bento-card p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)] shrink-0">
        <Icon className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { bg, text, label } = getStatusStyle(status)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}

function DetailSheet({ event, onClose }: { event: DispatchEvent; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--glass-border)] p-6 shadow-2xl"
        style={{ background: 'var(--bg-secondary)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dispatch Detail</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs px-2 py-1 rounded"
          >
            close
          </button>
        </div>
        <dl className="space-y-3 text-xs">
          <div className="flex gap-3">
            <dt className="text-[var(--text-muted)] w-24 shrink-0">Started</dt>
            <dd className="text-[var(--text-secondary)] font-mono">
              {event.started_at ? new Date(event.started_at).toLocaleString() : '—'}
            </dd>
          </div>
          {event.completed_at && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Completed</dt>
              <dd className="text-[var(--text-secondary)] font-mono">
                {new Date(event.completed_at).toLocaleString()}
              </dd>
            </div>
          )}
          <div className="flex gap-3">
            <dt className="text-[var(--text-muted)] w-24 shrink-0">Agent</dt>
            <dd className="text-[var(--text-primary)] font-medium">{event.agent}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-[var(--text-muted)] w-24 shrink-0">Status</dt>
            <dd><StatusBadge status={event.status} /></dd>
          </div>
          {event.duration_ms != null && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Duration</dt>
              <dd className="text-[var(--text-secondary)] font-mono">{(event.duration_ms / 1000).toFixed(1)}s</dd>
            </div>
          )}
          {event.session_id && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Session</dt>
              <dd className="font-mono text-[var(--text-secondary)] break-all">{event.session_id}</dd>
            </div>
          )}
          {event.prompt_preview && (
            <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Prompt</dt>
              <dd className="text-[var(--text-secondary)] break-words leading-relaxed">{event.prompt_preview}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function RoutingLogView() {
  const { data: events = [], isLoading, dataUpdatedAt } = useDispatchEvents(500)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [selectedEvent, setSelectedEvent] = useState<DispatchEvent | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // ── Derived stats ──
  const stats = useMemo(() => {
    const total = events.length
    const completed = events.filter(e => e.status === 'completed').length
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

    const agentCounts: Record<string, number> = {}
    for (const e of events) {
      agentCounts[e.agent] = (agentCounts[e.agent] ?? 0) + 1
    }
    const topAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    const withDuration = events.filter(e => e.duration_ms != null)
    const avgDurationMs = withDuration.length > 0
      ? Math.round(withDuration.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) / withDuration.length)
      : null
    const avgDuration = avgDurationMs != null ? `${(avgDurationMs / 1000).toFixed(1)}s` : '—'

    return { total, successRate, topAgent, avgDuration }
  }, [events])

  // ── Chart data: dispatches per hour over last 24h ──
  const chartData = useMemo(() => {
    const now = Date.now()
    const buckets: Record<number, number> = {}
    for (let h = 23; h >= 0; h--) {
      buckets[h] = 0
    }
    for (const e of events) {
      if (!e.started_at) continue
      const ageMs = now - new Date(e.started_at).getTime()
      const ageHr = Math.floor(ageMs / 3_600_000)
      if (ageHr >= 0 && ageHr < 24) {
        const key = 23 - ageHr
        buckets[key] = (buckets[key] ?? 0) + 1
      }
    }
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i === 23 ? 'now' : `-${23 - i}h`,
      dispatches: buckets[i] ?? 0,
    }))
  }, [events])

  // ── Filtered table rows ──
  const filtered = useMemo(() => {
    if (filter === 'completed') return events.filter(e => e.status === 'completed')
    if (filter === 'failed')    return events.filter(e => e.status === 'failed')
    return events
  }, [events, filter])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  if (isLoading) {
    return (
      <div className="p-8 text-[var(--text-muted)] text-sm">Loading dispatch history...</div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Dispatch History</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {events.length} events loaded · last updated {lastUpdated}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill icon={Activity}      label="Total Dispatches" value={stats.total} />
        <StatPill icon={CheckCircle2}  label="Success Rate"     value={`${stats.successRate}%`} sub={`${events.filter(e => e.status === 'completed').length} completed`} />
        <StatPill icon={TrendingUp}    label="Top Agent"        value={stats.topAgent} />
        <StatPill icon={Timer}         label="Avg Duration"     value={stats.avgDuration} sub="per dispatch" />
      </div>

      {/* Area chart */}
      <div className="bento-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Dispatches (last 24h)</span>
        </div>
        <div className="min-h-[180px]">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dispatchGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00FFC2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00FFC2" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={5}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="dispatches"
                stroke="#00FFC2"
                strokeWidth={2}
                fill="url(#dispatchGradient)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter tabs + table */}
      <div className="bento-card overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-3 border-b border-[var(--border)]">
          {(['all', 'completed', 'failed'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-[var(--accent)] text-[#070A0F]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'completed' ? 'Completed' : 'Failed'}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--text-muted)]">{filtered.length} rows</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left px-4 py-2.5 font-medium w-6"></th>
                <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Time</th>
                <th className="text-left px-4 py-2.5 font-medium">Agent</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium">Prompt Preview</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No dispatch events found
                  </td>
                </tr>
              )}
              {filtered.map((event, i) => {
                const isExpanded = expandedRows.has(i)
                const ts = event.started_at
                  ? new Date(event.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'
                const durationStr = event.duration_ms != null
                  ? `${(event.duration_ms / 1000).toFixed(1)}s`
                  : '—'
                return (
                  <Fragment key={i}>
                    <tr
                      className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/40 cursor-pointer transition-colors"
                      onClick={() => setSelectedEvent(event)}
                    >
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">
                        <button
                          className="p-0.5 hover:text-[var(--text-primary)] transition-colors"
                          onClick={e => {
                            e.stopPropagation()
                            setExpandedRows(prev => {
                              const next = new Set(prev)
                              next.has(i) ? next.delete(i) : next.add(i)
                              return next
                            })
                          }}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3 h-3" />
                            : <ChevronRight className="w-3 h-3" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[var(--text-muted)] whitespace-nowrap">{ts}</td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] font-medium">{event.agent}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={event.status} /></td>
                      <td className="px-4 py-2.5 font-mono text-[var(--text-muted)] hidden md:table-cell">
                        {durationStr}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] max-w-[280px] truncate">
                        {event.prompt_preview || <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${i}-expanded`} className="bg-[var(--bg-tertiary)]/30 border-b border-[var(--border)]/50">
                        <td colSpan={6} className="px-8 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
                            {event.session_id && (
                              <div><span className="text-[var(--text-muted)]">session: </span><span className="font-mono text-[var(--text-secondary)]">{event.session_id.slice(0, 16)}…</span></div>
                            )}
                            {event.cost_usd != null && (
                              <div><span className="text-[var(--text-muted)]">cost: </span><span className="font-mono text-[var(--text-secondary)]">${event.cost_usd.toFixed(4)}</span></div>
                            )}
                            {event.prompt_preview && (
                              <div className="col-span-3 pt-1 border-t border-[var(--border)]/50 mt-1">
                                <span className="text-[var(--text-muted)]">prompt: </span>
                                <span className="text-[var(--text-secondary)] break-words">{event.prompt_preview}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail sheet modal */}
      {selectedEvent && (
        <DetailSheet event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}
