import { useDispatchEvents, useRoutingStats } from '../../api/useRouting'
import { formatDuration, timeAgo } from '../../../shared/time.js'
import StatusPill from '../StatusPill'

// Dispatch overview from cast.db agent_runs (via /api/routing/{stats,events}).
export default function DispatchActivityPanel() {
  const { data: stats } = useRoutingStats()
  const { data: events = [] } = useDispatchEvents({ limit: 50 })

  const recent = events.slice(0, 8)
  const statusEntries = Object.entries(stats?.byStatus ?? {}).sort((a, b) => b[1] - a[1])

  if ((stats?.total ?? 0) === 0 && recent.length === 0) return null

  return (
    <div className="bento-card overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dispatch Activity</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">Agent dispatches recorded in cast.db (agent_runs)</p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
        <div className="bg-[var(--bg-secondary)] px-4 py-3">
          <div className="text-xl font-bold text-[var(--text-primary)] tabular-nums">{stats?.total ?? 0}</div>
          <div className="text-xs text-[var(--text-muted)]">Total dispatches</div>
        </div>
        <div className="bg-[var(--bg-secondary)] px-4 py-3">
          <div className="text-xl font-bold text-[var(--accent)] tabular-nums">{stats?.last24hCount ?? 0}</div>
          <div className="text-xs text-[var(--text-muted)]">Last 24h</div>
        </div>
        <div className="bg-[var(--bg-secondary)] px-4 py-3 col-span-2">
          <div className="text-xl font-bold text-[var(--text-primary)] truncate" title={stats?.topAgent ?? undefined}>
            {stats?.topAgent ?? '—'}
          </div>
          <div className="text-xs text-[var(--text-muted)]">Most dispatched agent</div>
        </div>
      </div>

      {/* Status breakdown */}
      {statusEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 py-3 border-t border-[var(--border)]">
          {statusEntries.map(([status, count]) => (
            <StatusPill key={status} status={status} label={`${status} · ${count}`} />
          ))}
        </div>
      )}

      {/* Recent dispatches */}
      {recent.length > 0 && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {recent.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 px-6 py-2.5">
              <span className="font-medium text-sm text-[var(--text-primary)] truncate flex-1" title={ev.prompt_preview ?? undefined}>
                {ev.agent}
              </span>
              <StatusPill status={ev.status} />
              {ev.duration_ms != null && (
                <span className="text-xs text-[var(--text-muted)] tabular-nums w-14 text-right">{formatDuration(ev.duration_ms)}</span>
              )}
              <span className="text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap w-20 text-right">{timeAgo(ev.started_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
