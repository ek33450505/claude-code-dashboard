import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { useTokenSpend } from '../../api/useTokenSpend'
import { useBudgetStatus } from '../../api/useBudgetStatus'
import { formatTokens, formatCost } from '../../../shared/format.js'
import { useChartColors } from '../../lib/useChartColors'
import { tooltipStyle } from './tooltipStyle'

export default function TokenSpendInline() {
  const { data, isLoading } = useTokenSpend()
  const { data: budget } = useBudgetStatus()
  const reduced = useReducedMotion()
  const c = useChartColors()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bento-card p-5 h-24 animate-pulse" />)}
        </div>
        <div className="bento-card p-6 h-64 animate-pulse" />
      </div>
    )
  }

  if (!data) return <div className="p-6 text-[var(--text-muted)]">No token spend data available.</div>

  const { totals, daily } = data

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatCost(totals.costUsd)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Total Cost (30d)</div>
          {budget?.daily_limit != null && (
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Daily limit: {formatCost(budget.daily_limit)}
            </div>
          )}
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(totals.inputTokens)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Input Tokens</div>
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(totals.outputTokens)}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Output Tokens</div>
        </div>
        <div className="bento-card p-5">
          <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{totals.sessionCount}</div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">Sessions</div>
        </div>
      </div>

      {/* Daily cost chart */}
      {daily.length > 0 && (
        <div className="bento-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Daily Token Spend</h2>
          <div role="img" aria-label="Area chart of daily token spend over the last 30 days">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#88A3D6' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#88A3D6' }} tickFormatter={v => `$${Number(v).toFixed(2)}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
              <Area type="monotone" dataKey="costUsd" stroke={c.mint} fill={c.mintDim} strokeWidth={2} isAnimationActive={!reduced} />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cache token info */}
      {(totals.cacheCreationTokens > 0 || totals.cacheReadTokens > 0) && (
        <div className="bento-card p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Cache Tokens</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[var(--text-muted)]">Cache Creation:</span>
              <span className="ml-2 font-mono text-[var(--text-secondary)]">{formatTokens(totals.cacheCreationTokens)}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Cache Reads:</span>
              <span className="ml-2 font-mono text-[var(--text-secondary)]">{formatTokens(totals.cacheReadTokens)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
