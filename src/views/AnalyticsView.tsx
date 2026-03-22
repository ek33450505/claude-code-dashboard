import { useState, useMemo, lazy, Suspense } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, Coins, TrendingUp, Clock } from 'lucide-react'
import { useAnalytics } from '../api/useAnalytics'
import { formatTokens, formatCost } from '../utils/costEstimate'
import { formatDuration } from '../utils/time'

const ResponsiveHeatMap = lazy(() =>
  import('@nivo/heatmap').then(m => ({ default: m.ResponsiveHeatMap }))
)

const CHART_COLORS = {
  mint: '#00FFC2',
  mintDim: 'rgba(0,255,194,0.3)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.3)',
  purple: '#A78BFA',
  blue: '#60A5FA',
  rose: '#FB7185',
  gray: '#6B7280',
}

const MODEL_COLORS: Record<string, string> = {
  sonnet: '#00FFC2',
  haiku: '#60A5FA',
  opus: '#A78BFA',
}

function getModelColor(model: string): string {
  if (model.includes('sonnet')) return MODEL_COLORS.sonnet
  if (model.includes('haiku')) return MODEL_COLORS.haiku
  if (model.includes('opus')) return MODEL_COLORS.opus
  return CHART_COLORS.gray
}

function getModelShort(model: string): string {
  return model.replace('claude-', '').replace(/-\d{8}$/, '')
}

// Custom tooltip styles
const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function HeatmapChart({ sessionsByDay }: { sessionsByDay: Array<{ date: string; inputTokens: number; outputTokens: number }> }) {
  const heatData = useMemo(() => {
    return DAYS.map(day => ({
      id: day,
      data: sessionsByDay
        .filter(d => {
          const weekday = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })
          return weekday.startsWith(day.slice(0, 3))
        })
        .slice(-4)
        .map((d, i) => ({ x: `W${i + 1}`, y: d.inputTokens + d.outputTokens })),
    })).filter(row => row.data.length > 0)
  }, [sessionsByDay])

  if (heatData.length === 0) return null

  return (
    <ResponsiveHeatMap
      data={heatData}
      margin={{ top: 30, right: 30, bottom: 30, left: 50 }}
      axisTop={{ tickSize: 0, tickPadding: 8 }}
      axisLeft={{ tickSize: 0, tickPadding: 8 }}
      colors={{
        type: 'sequential',
        colors: ['rgba(0,255,194,0.05)', 'rgba(0,255,194,0.15)', 'rgba(0,255,194,0.35)', 'rgba(0,255,194,0.6)', '#00FFC2'],
      }}
      emptyColor="rgba(255,255,255,0.02)"
      borderRadius={4}
      borderWidth={1}
      borderColor="rgba(255,255,255,0.04)"
      enableLabels={false}
      theme={{
        text: { fill: '#88A3D6', fontSize: 11 },
        grid: { line: { stroke: 'rgba(255,255,255,0.06)' } },
      }}
      tooltip={({ cell }) => (
        <div className="glass-surface px-3 py-2 rounded-lg text-xs text-[var(--text-primary)]">
          {cell.serieId} {cell.data.x} — {typeof cell.value === 'number' ? cell.value.toLocaleString() : cell.value} tokens
        </div>
      )}
    />
  )
}

type SortKey = 'project' | 'sessions' | 'tokens' | 'cost'
type SortDir = 'asc' | 'desc'

export default function AnalyticsView() {
  const { data, isLoading, error } = useAnalytics()
  const [sortKey, setSortKey] = useState<SortKey>('cost')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sortedProjects = useMemo(() => {
    if (!data?.sessionsByProject) return []
    return [...data.sessionsByProject].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'project') return mul * a.project.localeCompare(b.project)
      return mul * ((a[sortKey] as number) - (b[sortKey] as number))
    })
  }, [data?.sessionsByProject, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div><h1 className="text-2xl font-bold">Analytics</h1></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bento-card p-5 animate-pulse">
              <div className="h-8 w-20 bg-[var(--bg-tertiary)] rounded mb-2" />
              <div className="h-4 w-28 bg-[var(--bg-tertiary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Failed to load analytics: {(error as Error).message}
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalTokens = data.totalInputTokens + data.totalOutputTokens

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Token usage, costs, and tool breakdown across all sessions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Activity}
          label="Total Sessions"
          value={String(data.totalSessions)}
          sub={data.avgSessionDurationMs > 0 ? `avg ${formatDuration(data.avgSessionDurationMs)}` : undefined}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Tokens"
          value={formatTokens(totalTokens)}
          sub={`${formatTokens(data.totalInputTokens)} in · ${formatTokens(data.totalOutputTokens)} out`}
        />
        <StatCard
          icon={Coins}
          label="Estimated Spend"
          value={formatCost(data.estimatedCostUSD)}
          sub={data.totalSessions > 0 ? `avg ${formatCost(data.estimatedCostUSD / data.totalSessions)} / session` : undefined}
        />
        <StatCard
          icon={Clock}
          label="Avg Tokens / Session"
          value={formatTokens(data.avgTokensPerSession)}
          sub={data.totalCacheReadTokens > 0 ? `${formatTokens(data.totalCacheReadTokens)} cache hits` : undefined}
        />
      </div>

      {/* Daily Token Burn Chart */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Daily Token Usage (Last 90 Days)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.sessionsByDay}>
              <defs>
                <linearGradient id="gradientMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.mint} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.mint} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(v: number) => formatTokens(v)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatTokens(v)} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#88A3D6' }} />
              <Area type="monotone" dataKey="inputTokens" name="Input" stroke={CHART_COLORS.mint} fill="url(#gradientMint)" strokeWidth={2} />
              <Area type="monotone" dataKey="outputTokens" name="Output" stroke={CHART_COLORS.amber} fill="url(#gradientAmber)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two-column: Tool Usage + Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tool Usage Bar Chart */}
        {data.toolUsage.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Top Tools by Usage</h2>
            <ResponsiveContainer width="100%" height={Math.max(250, data.toolUsage.slice(0, 10).length * 32)}>
              <BarChart data={data.toolUsage.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fill: '#88A3D6', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <YAxis
                  type="category"
                  dataKey="tool"
                  width={120}
                  tick={{ fill: '#E6E8EE', fontSize: 11, fontFamily: 'Geist Mono, monospace' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Calls" fill={CHART_COLORS.mint} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Model Breakdown Pie */}
        {data.modelBreakdown.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Cost by Model</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.modelBreakdown.filter(e => e.cost > 0)}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="cost"
                  nameKey="model"
                  label={false}
                >
                  {data.modelBreakdown.filter(e => e.cost > 0).map((entry) => (
                    <Cell key={entry.model} fill={getModelColor(entry.model)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, _name: string, props: unknown) => {
                    const p = props as { payload?: { model?: string; sessions?: number; tokens?: number } }
                    const model = p.payload?.model || ''
                    const sessions = p.payload?.sessions ?? 0
                    const tokens = p.payload?.tokens ?? 0
                    return [`${formatCost(v)} (${sessions} sessions, ${formatTokens(tokens)} tokens)`, getModelShort(model)]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend below chart — avoids label overlap */}
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {data.modelBreakdown.filter(e => e.cost > 0).map((entry) => {
                const totalCost = data.modelBreakdown.filter(e => e.cost > 0).reduce((s, e) => s + e.cost, 0)
                const pct = totalCost > 0 ? ((entry.cost / totalCost) * 100).toFixed(1) : '0'
                return (
                  <div key={entry.model} className="flex items-center gap-2 text-xs">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getModelColor(entry.model) }} />
                    <span className="text-[var(--text-secondary)]">{getModelShort(entry.model)}</span>
                    <span className="text-[var(--accent)] font-medium tabular-nums">{formatCost(entry.cost)}</span>
                    <span className="text-[var(--text-muted)]">({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Model Usage Heatmap */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Token Usage by Day of Week</h2>
          <div style={{ height: 260 }}>
            <Suspense fallback={
              <div className="h-full w-full animate-pulse rounded-lg bg-[var(--bg-tertiary)]" />
            }>
              <HeatmapChart sessionsByDay={data.sessionsByDay} />
            </Suspense>
          </div>
        </div>
      )}

      {/* Project Cost Table */}
      {sortedProjects.length > 0 && (
        <div className="bento-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Cost by Project</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th onClick={() => toggleSort('project')} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent)] transition-colors">
                    Project{sortIndicator('project')}
                  </th>
                  <th onClick={() => toggleSort('sessions')} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent)] transition-colors">
                    Sessions{sortIndicator('sessions')}
                  </th>
                  <th onClick={() => toggleSort('tokens')} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent)] transition-colors">
                    Tokens{sortIndicator('tokens')}
                  </th>
                  <th onClick={() => toggleSort('cost')} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer hover:text-[var(--accent)] transition-colors">
                    Est. Cost{sortIndicator('cost')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map(({ project, sessions, tokens, cost }) => (
                  <tr key={project} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-6 py-3 font-semibold text-[var(--text-primary)]">{project}</td>
                    <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{sessions}</td>
                    <td className="px-6 py-3 text-right text-[var(--text-secondary)] tabular-nums">{formatTokens(tokens)}</td>
                    <td className="px-6 py-3 text-right text-[var(--accent)] tabular-nums font-medium">{formatCost(cost)}</td>
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
