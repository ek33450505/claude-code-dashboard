import { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, Coins, TrendingUp, Clock, RefreshCw } from 'lucide-react'
import { useSeed } from '../../api/useSeed'
import { useRoutingEventsByType } from '../../api/useRoutingEventsByType'
import { useChartColors } from '../../lib/useChartColors'
import { formatTokens, formatCost } from '../../../shared/format.js'
import { formatDuration } from '../../../shared/time.js'
import type { AnalyticsData } from '../../api/useAnalytics'
import CompactStatCard from '../CompactStatCard'
import DelegationSavingsPanel from './DelegationSavingsPanel'
import CacheBreakdownPanel from './CacheBreakdownPanel'
import DispatchActivityPanel from './DispatchActivityPanel'
import AgentScorecard from './AgentScorecard'
import { tooltipStyle } from './tooltipStyle'

type SortKey = 'project' | 'sessions' | 'tokens' | 'cost'
type SortDir = 'asc' | 'desc'

const MODEL_COLORS: Record<string, string> = {
  fable:  '#F87171', // rose-400 — matches badge palette
  sonnet: '#00FFC2',
  haiku:  '#60A5FA',
  opus:   '#A78BFA',
}

function getModelColor(model: string): string {
  if (model.includes('fable'))  return MODEL_COLORS.fable
  if (model.includes('sonnet')) return MODEL_COLORS.sonnet
  if (model.includes('haiku'))  return MODEL_COLORS.haiku
  if (model.includes('opus'))   return MODEL_COLORS.opus
  return '#6B7280' // neutral gray — legible in both themes
}

function getModelShort(model: string): string {
  return model.replace('claude-', '').replace(/-\d{8}$/, '')
}

export default function AgentsTabPanel({ data, totalTokens }: { data: AnalyticsData; totalTokens: number }) {
  const { loading: seedLoading, result: seedResult, error: seedError, trigger: runSeed } = useSeed()
  const { data: promptEvents } = useRoutingEventsByType({ event_type: 'user_prompt_submit', limit: 200 })
  const c = useChartColors()

  const promptActivityData = useMemo(() => {
    if (!promptEvents || promptEvents.length === 0) return []
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 13) // 14 days including today
    const counts: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const d = new Date(cutoff)
      d.setDate(cutoff.getDate() + i)
      counts[d.toISOString().slice(0, 10)] = 0
    }
    for (const ev of promptEvents) {
      const day = ev.timestamp.slice(0, 10)
      if (day in counts) counts[day] = (counts[day] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))
  }, [promptEvents])

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
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div />
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={runSeed}
            disabled={seedLoading}
            aria-busy={seedLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${seedLoading ? 'animate-spin' : ''}`} />
            {seedLoading ? 'Seeding…' : 'Refresh Data'}
          </button>
          <div aria-live="polite" aria-atomic="true" className="text-xs">
            {seedResult && (
              <span className="text-emerald-400">
                +{seedResult.seeded.sessions} sessions, +{seedResult.seeded.agentRuns} runs
              </span>
            )}
            {seedError && (
              <span className="text-[var(--error)]">{seedError}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactStatCard
          icon={Activity}
          label="Total Sessions"
          value={String(data.totalSessions)}
          sub={data.avgSessionDurationMs > 0 ? `avg ${formatDuration(data.avgSessionDurationMs)}` : undefined}
          hover={false}
        />
        <CompactStatCard
          icon={TrendingUp}
          label="Total Tokens"
          value={formatTokens(totalTokens)}
          sub={`${formatTokens(data.totalInputTokens)} in · ${formatTokens(data.totalOutputTokens)} out`}
          hover={false}
        />
        <CompactStatCard
          icon={Coins}
          label="Estimated Spend"
          value={formatCost(data.estimatedCostUSD)}
          sub={data.totalSessions > 0 ? `avg ${formatCost(data.estimatedCostUSD / data.totalSessions)} / session${data.monthPrefix ? ' · this month' : ''}` : undefined}
          hover={false}
        />
        <CompactStatCard
          icon={Clock}
          label="Avg Tokens / Session"
          value={formatTokens(data.avgTokensPerSession)}
          sub={data.totalCacheReadTokens > 0 ? `${formatTokens(data.totalCacheReadTokens)} cache hits` : undefined}
          hover={false}
        />
      </div>

      {/* Delegation Savings */}
      {data.delegationSavings && (
        <DelegationSavingsPanel savings={data.delegationSavings} />
      )}

      {/* Cache Efficiency */}
      {(data.totalCacheCreationTokens > 0 || data.totalCacheReadTokens > 0) && (
        <CacheBreakdownPanel
          totalCacheCreationTokens={data.totalCacheCreationTokens}
          totalCacheReadTokens={data.totalCacheReadTokens}
        />
      )}

      {/* Daily Token Burn Chart */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Daily Token Usage (Last 90 Days)</h2>
          <div className="min-h-[180px]" role="img" aria-label="Area chart showing daily input and output token usage over the last 90 days">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.sessionsByDay}>
              <defs>
                <linearGradient id="gradientMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.mint} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c.mint} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradientAmber" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c.amber} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c.amber} stopOpacity={0} />
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
              <Area type="monotone" dataKey="inputTokens" name="Input" stroke={c.mint} fill="url(#gradientMint)" strokeWidth={2} />
              <Area type="monotone" dataKey="outputTokens" name="Output" stroke={c.amber} fill="url(#gradientAmber)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Two-column: Tool Usage + Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tool Usage Bar Chart */}
        {data.toolUsage.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Top Tools by Usage</h2>
            <div className="min-h-[180px]" role="img" aria-label="Horizontal bar chart showing the top 10 most-used tools by call count">
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
                <Bar dataKey="count" name="Calls" fill={c.mint} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Model Breakdown Pie */}
        {data.modelBreakdown.length > 0 && (
          <div className="bento-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">Cost by Model</h2>
            <div className="min-h-[180px]" role="img" aria-label="Donut chart showing estimated cost breakdown by Claude model (Haiku, Sonnet, Opus)">
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
            </div>
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

      {/* Daily Token Burn — last 30 days */}
      {data.sessionsByDay.length > 1 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Daily Token Burn (Last 30 Days)
          </h2>
          <div className="min-h-[180px]" role="img" aria-label="Stacked bar chart showing daily input and output token burn over the last 30 days">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.sessionsByDay.slice(-30)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#88A3D6', fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(v: number) => formatTokens(v)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [formatTokens(v)]} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: '#88A3D6' }} />
              <Bar dataKey="inputTokens" name="Input" stackId="a" fill={c.mint} opacity={0.85} />
              <Bar dataKey="outputTokens" name="Output" stackId="a" fill={c.amber} opacity={0.85} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dispatch Activity */}
      <DispatchActivityPanel />

      {/* Agent Scorecard */}
      <AgentScorecard />

      {/* Prompt Activity */}
      {promptActivityData.length > 0 && (
        <div className="bento-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Prompt Activity (Last 14 Days)</h2>
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
              {promptActivityData.reduce((s, d) => s + d.count, 0)} total
            </span>
          </div>
          <div className="min-h-[160px]" role="img" aria-label="Bar chart showing daily user prompt submissions over the last 14 days">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={promptActivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#88A3D6', fontSize: 10 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#88A3D6', fontSize: 11 }}
                  allowDecimals={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Prompts" fill={c.purple} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Project Cost Table */}
      {sortedProjects.length > 0 && (
        <div className="bento-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Cost by Project</h2>
          </div>
          <div className="overflow-x-auto" role="region" aria-label="Cost by project — sortable table">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" aria-sort={sortKey === 'project' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('project')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Project{sortIndicator('project')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'sessions' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('sessions')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Sessions{sortIndicator('sessions')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'tokens' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('tokens')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Tokens{sortIndicator('tokens')}
                    </button>
                  </th>
                  <th scope="col" aria-sort={sortKey === 'cost' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    <button type="button" onClick={() => toggleSort('cost')} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-[var(--accent)] transition-colors">
                      Est. Cost{sortIndicator('cost')}
                    </button>
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
}

