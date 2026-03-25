import { useState, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Activity, AlertCircle, TrendingUp, Zap, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import type { RoutingEvent } from '../types'
import RouteProposalsPanel from '../components/RouteProposalsPanel'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  dispatched:          { bg: 'bg-emerald-500/20', text: 'text-emerald-300',  label: 'dispatched' },
  suggested:           { bg: 'bg-emerald-500/20', text: 'text-emerald-300',  label: 'suggested' },
  no_match:            { bg: 'bg-zinc-500/20',    text: 'text-zinc-400',     label: 'no_match' },
  opus_escalation:     { bg: 'bg-purple-500/20',  text: 'text-purple-300',   label: 'opus' },
  skipped:             { bg: 'bg-zinc-500/20',    text: 'text-zinc-400',     label: 'skipped' },
  agent_dispatch:      { bg: 'bg-blue-500/20',    text: 'text-blue-300',     label: 'agent_dispatch' },
  senior_dev_dispatch: { bg: 'bg-blue-500/20',    text: 'text-blue-300',     label: 'senior_dev' },
  agent_complete:      { bg: 'bg-teal-500/20',    text: 'text-teal-300',     label: 'complete' },
  catchall_dispatched: { bg: 'bg-purple-500/20',  text: 'text-purple-300',   label: 'catchall' },
  depth_limit_reached: { bg: 'bg-red-500/20',     text: 'text-red-400',      label: 'depth_limit' },
  config_error:        { bg: 'bg-red-500/20',     text: 'text-red-400',      label: 'config_error' },
  subprocess_skip:     { bg: 'bg-zinc-700/30',    text: 'text-zinc-500',     label: 'subprocess' },
}

function getActionStyle(action: string) {
  return ACTION_COLORS[action] ?? { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: action }
}

type FilterMode = 'all' | 'dispatched' | 'no_match'

const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useRoutingEvents(limit = 500) {
  return useQuery<RoutingEvent[]>({
    queryKey: ['routing', 'events', limit],
    queryFn: async () => {
      const res = await fetch(`/api/routing/events?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch routing events')
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

function ActionBadge({ action }: { action: string }) {
  const { bg, text, label } = getActionStyle(action)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}

function DetailSheet({ event, onClose }: { event: RoutingEvent; onClose: () => void }) {
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
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Event Detail</h3>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-xs px-2 py-1 rounded"
          >
            close
          </button>
        </div>
        <dl className="space-y-3 text-xs">
          <div className="flex gap-3">
            <dt className="text-[var(--text-muted)] w-24 shrink-0">Timestamp</dt>
            <dd className="text-[var(--text-secondary)] font-mono">
              {event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}
            </dd>
          </div>
          <div className="flex gap-3">
            <dt className="text-[var(--text-muted)] w-24 shrink-0">Action</dt>
            <dd><ActionBadge action={event.action} /></dd>
          </div>
          {event.matchedRoute && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Agent</dt>
              <dd className="text-[var(--text-primary)] font-medium">{event.matchedRoute}</dd>
            </div>
          )}
          {event.command && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Command</dt>
              <dd className="font-mono text-[var(--text-secondary)]">{event.command}</dd>
            </div>
          )}
          {event.pattern && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Pattern</dt>
              <dd className="font-mono text-[var(--text-secondary)] break-all">{event.pattern}</dd>
            </div>
          )}
          {event.reasoning && (
            <div className="flex gap-3">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Reasoning</dt>
              <dd className="text-[var(--text-secondary)]">{event.reasoning}</dd>
            </div>
          )}
          {event.promptPreview && (
            <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
              <dt className="text-[var(--text-muted)] w-24 shrink-0">Prompt</dt>
              <dd className="text-[var(--text-secondary)] break-words leading-relaxed">{event.promptPreview}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function RoutingLogView() {
  const { data: events = [], isLoading, dataUpdatedAt } = useRoutingEvents(500)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [selectedEvent, setSelectedEvent] = useState<RoutingEvent | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // ── Derived stats ──
  const stats = useMemo(() => {
    const total = events.length
    const dispatched = events.filter(e =>
      e.action === 'dispatched' || e.action === 'suggested' || e.action === 'agent_dispatch'
    ).length
    const noMatch = events.filter(e => e.action === 'no_match').length
    const noMatchRate = total > 0 ? Math.round((noMatch / total) * 100) : 0

    const agentCounts: Record<string, number> = {}
    for (const e of events) {
      if (e.matchedRoute) {
        agentCounts[e.matchedRoute] = (agentCounts[e.matchedRoute] ?? 0) + 1
      }
    }
    const topAgent = Object.entries(agentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

    const catchall = events.filter(e => e.matchedRoute === 'opus' || e.action === 'opus_escalation' || e.action === 'catchall_dispatched').length
    const catchallRate = total > 0 ? Math.round((catchall / total) * 100) : 0

    return { total, dispatched, noMatchRate, topAgent, catchallRate }
  }, [events])

  // ── Chart data: dispatches per hour over last 24h ──
  const chartData = useMemo(() => {
    const now = Date.now()
    const buckets: Record<number, number> = {}
    for (let h = 23; h >= 0; h--) {
      const key = h
      buckets[key] = 0
    }
    for (const e of events) {
      if (!e.timestamp) continue
      const ageMs = now - new Date(e.timestamp).getTime()
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
    if (filter === 'dispatched') {
      return events.filter(e =>
        e.action === 'dispatched' || e.action === 'suggested' || e.action === 'agent_dispatch'
      )
    }
    if (filter === 'no_match') {
      return events.filter(e => e.action === 'no_match')
    }
    return events
  }, [events, filter])

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  if (isLoading) {
    return (
      <div className="p-8 text-[var(--text-muted)] text-sm">Loading routing events...</div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Routing Log</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {events.length} events loaded · last updated {lastUpdated}
          </p>
        </div>
      </div>

      {/* Route Proposals Panel */}
      <RouteProposalsPanel />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill icon={Activity}   label="Total Dispatches"  value={stats.total} />
        <StatPill icon={AlertCircle} label="No-Match Rate"    value={`${stats.noMatchRate}%`} sub={`${events.filter(e => e.action === 'no_match').length} unmatched`} />
        <StatPill icon={TrendingUp} label="Top Agent"         value={stats.topAgent} />
        <StatPill icon={Zap}        label="Catchall Rate"     value={`${stats.catchallRate}%`} sub="opus escalations" />
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
              <linearGradient id="routingGradient" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#routingGradient)"
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
          {(['all', 'dispatched', 'no_match'] as FilterMode[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-[var(--accent)] text-[#070A0F]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {f === 'all' ? 'All' : f === 'dispatched' ? 'Dispatched' : 'No Match'}
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
                <th className="text-left px-4 py-2.5 font-medium">Action</th>
                <th className="text-left px-4 py-2.5 font-medium">Agent</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Pattern</th>
                <th className="text-left px-4 py-2.5 font-medium">Prompt Preview</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                    No events found
                  </td>
                </tr>
              )}
              {filtered.map((event, i) => {
                const isExpanded = expandedRows.has(i)
                const ts = event.timestamp
                  ? new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'
                return (
                  <Fragment key={i}>
                    <tr
                      key={i}
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
                      <td className="px-4 py-2.5"><ActionBadge action={event.action} /></td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] font-medium">
                        {event.matchedRoute ?? <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[var(--text-muted)] hidden md:table-cell max-w-[180px] truncate">
                        {event.pattern ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-secondary)] max-w-[280px] truncate">
                        {event.promptPreview || <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${i}-expanded`} className="bg-[var(--bg-tertiary)]/30 border-b border-[var(--border)]/50">
                        <td colSpan={6} className="px-8 py-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
                            {event.command && (
                              <div><span className="text-[var(--text-muted)]">command: </span><span className="font-mono text-[var(--text-secondary)]">{event.command}</span></div>
                            )}
                            {event.reasoning && (
                              <div className="col-span-2"><span className="text-[var(--text-muted)]">reasoning: </span><span className="text-[var(--text-secondary)]">{event.reasoning}</span></div>
                            )}
                            {event.promptPreview && (
                              <div className="col-span-3 pt-1 border-t border-[var(--border)]/50 mt-1">
                                <span className="text-[var(--text-muted)]">prompt: </span>
                                <span className="text-[var(--text-secondary)] break-words">{event.promptPreview}</span>
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
