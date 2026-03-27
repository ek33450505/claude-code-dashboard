import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Coins, TrendingUp, Cpu, Cloud } from 'lucide-react'
import { useTokenSpend } from '../api/useTokenSpend'

const CHART_COLORS = {
  mint: '#00FFC2',
  mintDim: 'rgba(0,255,194,0.3)',
  amber: '#F59E0B',
  amberDim: 'rgba(245,158,11,0.3)',
  blue: '#60A5FA',
  blueDim: 'rgba(96,165,250,0.3)',
}

const tooltipStyle = {
  backgroundColor: '#1A1D23',
  border: '1px solid rgba(0,255,194,0.2)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#E6E8EE',
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
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

function formatCost(usd: number) {
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export default function TokenSpendView() {
  const { data, isLoading, error } = useTokenSpend()

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bento-card p-5 h-24 animate-pulse bg-[var(--bg-secondary)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bento-card p-6 text-[var(--error)]">
          Failed to load token spend data. Make sure the dashboard server is running.
        </div>
      </div>
    )
  }

  const { daily = [], totals, localTokens = 0, cloudTokens = 0 } = data ?? {
    daily: [], totals: { inputTokens: 0, outputTokens: 0, costUsd: 0, sessionCount: 0 }, localTokens: 0, cloudTokens: 0,
  }

  const totalTokens = (totals?.inputTokens ?? 0) + (totals?.outputTokens ?? 0)
  const localPct = totalTokens > 0 ? Math.round((localTokens / totalTokens) * 100) : 0
  const hasData = daily.length > 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Token Spend</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Last 30 days of token usage and costs from cast.db</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Coins} label="Total Spend (30d)" value={formatCost(totals?.costUsd ?? 0)} />
        <StatCard icon={TrendingUp} label="Sessions (30d)" value={String(totals?.sessionCount ?? 0)} />
        <StatCard icon={Cpu} label="Local Tokens" value={`${localPct}%`} sub={formatTokens(localTokens)} />
        <StatCard icon={Cloud} label="Cloud Tokens" value={formatTokens(cloudTokens)} />
      </div>

      {!hasData && (
        <div className="bento-card p-8 text-center text-[var(--text-muted)]">
          <Coins className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No token data yet</div>
          <div className="text-sm mt-1">Token spend data will appear here once CAST sessions are recorded in cast.db</div>
        </div>
      )}

      {hasData && (
        <>
          {/* Daily cost chart */}
          <div className="bento-card p-5">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Daily Cost (USD)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={daily} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.mint} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.mint} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']} />
                <Area type="monotone" dataKey="costUsd" stroke={CHART_COLORS.mint} fill="url(#costGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Token breakdown chart */}
          <div className="bento-card p-5">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Daily Token Breakdown</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} tickFormatter={v => formatTokens(Number(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [formatTokens(v), name === 'inputTokens' ? 'Input' : 'Output']} />
                <Legend formatter={v => v === 'inputTokens' ? 'Input' : 'Output'} />
                <Bar dataKey="inputTokens" stackId="tokens" fill={CHART_COLORS.mint} radius={[0, 0, 0, 0]} />
                <Bar dataKey="outputTokens" stackId="tokens" fill={CHART_COLORS.amber} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </>
      )}
    </div>
  )
}
