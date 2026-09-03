import { useMemo } from 'react'
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DollarSign, Activity } from 'lucide-react'
import { useAgentRunsDaily, useMcpCallsDaily } from '../../api/useCastData'
import { useChartColors } from '../../lib/useChartColors'
import CompactStatCard from '../CompactStatCard'
import { tooltipStyle } from './tooltipStyle'

const DAYS = 30

export default function RollupsTab() {
  const { data: runsDaily, isLoading: runsLoading } = useAgentRunsDaily({ days: DAYS })
  const { data: mcpDaily, isLoading: mcpLoading } = useMcpCallsDaily({ days: DAYS })
  const c = useChartColors()

  const { totalCost, totalRuns, avgCostPerRun, chartData } = useMemo(() => {
    const rows = runsDaily ?? []
    const cost = rows.reduce((sum, r) => sum + r.cost_usd, 0)
    const runs = rows.reduce((sum, r) => sum + r.runs, 0)
    // Sourced directly from the most recent completed day's server-computed
    // avg_cost_per_run field — never recomputed client-side from per-day
    // cost_usd values, which would reintroduce the AVG-of-sums bug the
    // backend was specifically built to avoid.
    const completed = rows.filter((r) => !r.is_partial)
    const latestCompleted = completed[completed.length - 1]

    return {
      totalCost: cost,
      totalRuns: runs,
      avgCostPerRun: latestCompleted ? latestCompleted.avg_cost_per_run : null,
      chartData: rows.map((r) => ({
        day: r.day,
        cost_usd: r.cost_usd,
        runs: r.runs,
        is_partial: r.is_partial,
      })),
    }
  }, [runsDaily])

  const totalMcpCalls = useMemo(
    () => (mcpDaily ?? []).reduce((sum, r) => sum + r.calls, 0),
    [mcpDaily]
  )

  const isLoading = runsLoading || mcpLoading

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bento-card p-5 h-24 animate-pulse" data-testid="rollups-skeleton" />
          ))}
        </div>
        <div className="bento-card p-6 h-64 animate-pulse" />
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="bento-card p-6 text-center text-[var(--text-muted)] text-sm">
        No rollup data found.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-[var(--text-muted)]">
        Last {DAYS} days, from the nightly cost rollup (~3:30am) — the rollup table is
        never pruned, so this history can extend further back than other cost views.
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactStatCard
          icon={DollarSign}
          label="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          sub={`last ${DAYS} days`}
          hover={false}
        />
        <CompactStatCard
          icon={Activity}
          label="Total Runs"
          value={totalRuns.toLocaleString()}
          sub={`last ${DAYS} days`}
          hover={false}
        />
        <CompactStatCard
          icon={DollarSign}
          label="Avg Cost / Run"
          value={avgCostPerRun != null ? `$${avgCostPerRun.toFixed(4)}` : '—'}
          sub="most recent completed day"
          hover={false}
        />
        <CompactStatCard
          icon={Activity}
          label="Total MCP Calls"
          value={totalMcpCalls.toLocaleString()}
          sub={`last ${DAYS} days`}
          hover={false}
        />
      </div>

      {/* Cost per day chart */}
      <div className="bento-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Cost per Day (Last {DAYS} Days)
        </h2>
        <div
          className="min-h-[180px]"
          role="img"
          aria-label={`Bar chart showing agent cost per day over the last ${DAYS} days; today's bar is shown with reduced opacity because the nightly rollup has not yet run`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="day"
                tick={{ fill: '#88A3D6', fontSize: 10 }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#88A3D6', fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value: number, _name, item) => [
                  `$${value.toFixed(2)}${item?.payload?.is_partial ? ' (partial — today, updates after nightly rollup)' : ''}`,
                  'Cost',
                ]}
              />
              <Bar dataKey="cost_usd" name="Cost" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                {chartData.map((row) => (
                  <Cell
                    key={row.day}
                    fill={c.mint}
                    fillOpacity={row.is_partial ? 0.35 : 1}
                    data-testid={row.is_partial ? 'rollup-bar-partial' : 'rollup-bar-complete'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {chartData.some((r) => r.is_partial) && (
          <p className="text-xs text-[var(--text-muted)] mt-3">
            Today&apos;s bar is faded — the nightly rollup runs ~3:30am, so today&apos;s total is
            still partial and not a true low-activity day.
          </p>
        )}
      </div>
    </div>
  )
}
