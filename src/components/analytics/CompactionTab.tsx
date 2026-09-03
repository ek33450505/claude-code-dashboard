import { useMemo } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Layers } from 'lucide-react'
import { useCompactionEvents } from '../../api/useCompactionEvents'
import { useChartColors } from '../../lib/useChartColors'
import CompactStatCard from '../CompactStatCard'
import { tooltipStyle } from './tooltipStyle'

export default function CompactionTab() {
  const { data, isLoading } = useCompactionEvents({ limit: 200 })
  const c = useChartColors()

  const { totalCount, chartData, recentEvents } = useMemo(() => {
    const events = data ?? []
    const total = events.length

    // Build 30-day chart: count events per day
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(today.getDate() - 29)
    const counts: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(cutoff)
      d.setDate(cutoff.getDate() + i)
      counts[d.toISOString().slice(0, 10)] = 0
    }
    for (const ev of events) {
      const day = (ev.timestamp ?? '').slice(0, 10)
      if (day in counts) counts[day] = (counts[day] ?? 0) + 1
    }
    const chart = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }))

    // Recent 20 for table
    const recent = events.slice(0, 20)

    return { totalCount: total, chartData: chart, recentEvents: recent }
  }, [data])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bento-card p-5 h-24 animate-pulse" />
        <div className="bento-card p-6 h-64 animate-pulse" />
        <div className="bento-card p-6 h-48 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CompactStatCard
          icon={Layers}
          label="Total Compaction Events"
          value={String(totalCount)}
          sub="last 200 events"
          hover={false}
        />
      </div>

      {/* Bar chart: events per day (last 30 days) */}
      <div className="bento-card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
          Compaction Events per Day (Last 30 Days)
        </h2>
        <div
          className="min-h-[180px]"
          role="img"
          aria-label="Bar chart showing compaction events per day over the last 30 days"
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
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
              <Bar dataKey="count" name="Compactions" fill={c.purple} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent events table */}
      {recentEvents.length > 0 ? (
        <div className="bento-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Recent Compaction Events
            </h2>
          </div>
          <div
            className="overflow-x-auto"
            role="region"
            aria-label="Recent compaction events table"
          >
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Session ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Trigger
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Tier
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <td className="px-6 py-3 font-mono text-xs text-[var(--text-secondary)]">
                      {ev.session_id ? ev.session_id.slice(0, 12) : '—'}
                    </td>
                    <td className="px-6 py-3 text-[var(--text-primary)]">
                      {ev.trigger || '—'}
                    </td>
                    <td className="px-6 py-3 text-[var(--text-secondary)]">
                      {ev.compaction_tier || '—'}
                    </td>
                    <td className="px-6 py-3 text-right text-[var(--text-muted)] tabular-nums text-xs">
                      {ev.timestamp ? ev.timestamp.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bento-card p-6 text-center text-[var(--text-muted)] text-sm">
          No compaction events found.
        </div>
      )}
    </div>
  )
}
