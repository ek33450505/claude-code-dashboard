import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react'
import { useHookHealth } from '../api/useHookHealth'
import type { HookHealthEntry } from '../api/useHookHealth'

function HealthBadge({ health }: { health: HookHealthEntry['health'] }) {
  if (health === 'green') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
        Healthy
      </span>
    )
  }
  if (health === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        Not executable
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400">
      <XCircle className="w-3 h-3" aria-hidden="true" />
      Missing
    </span>
  )
}

function formatLastFired(ts: string | null): string {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export default function HookHealthView() {
  const { data, isLoading, error, refetch, isFetching } = useHookHealth()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Hook Health Monitor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Status of all hooks registered in settings.json and settings.local.json
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/30 transition-colors disabled:opacity-50"
          aria-label="Refresh hook health"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="bento-card p-6 space-y-3">
          <div className="h-4 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bento-card p-6 text-[var(--error)] text-sm">
          Failed to load hook health data. Make sure the dashboard server is running.
        </div>
      )}

      {!isLoading && !error && data?.hooks.length === 0 && (
        <div className="bento-card p-8 text-center text-[var(--text-muted)]">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No hooks configured</div>
          <div className="text-sm mt-1">
            Add hooks to ~/.claude/settings.json or ~/.claude/settings.local.json to monitor them here.
          </div>
        </div>
      )}

      {!isLoading && !error && data && data.hooks.length > 0 && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-4">
            {(['green', 'yellow', 'red'] as const).map(h => {
              const count = data.hooks.filter(e => e.health === h).length
              const label = h === 'green' ? 'Healthy' : h === 'yellow' ? 'Not executable' : 'Missing'
              const color = h === 'green' ? 'text-emerald-400' : h === 'yellow' ? 'text-amber-400' : 'text-rose-400'
              const bg = h === 'green' ? 'bg-emerald-500/10' : h === 'yellow' ? 'bg-amber-500/10' : 'bg-rose-500/10'
              return (
                <div key={h} className={`bento-card p-4 flex items-center gap-3 ${bg}`}>
                  <span className={`text-2xl font-bold tabular-nums ${color}`}>{count}</span>
                  <span className="text-xs text-[var(--text-muted)]">{label}</span>
                </div>
              )
            })}
          </div>

          {/* Table */}
          <div className="bento-card overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                All Hooks ({data.hooks.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Hook Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Script Path
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hidden md:table-cell">
                      Last Fired
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.hooks.map((hook, i) => (
                    <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-6 py-3">
                        <HealthBadge health={hook.health} />
                      </td>
                      <td className="px-6 py-3 text-[var(--text-secondary)] font-mono text-xs">
                        {hook.hook_type}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-muted)] font-mono text-xs max-w-xs truncate" title={hook.script_path ?? hook.command}>
                        {hook.script_path ?? <span className="italic">{hook.command.slice(0, 60)}{hook.command.length > 60 ? '…' : ''}</span>}
                      </td>
                      <td className="px-6 py-3 text-[var(--text-muted)] text-xs hidden md:table-cell tabular-nums">
                        {formatLastFired(hook.last_fired_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
