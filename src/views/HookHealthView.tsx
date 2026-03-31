import { useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
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

/** Extract the script filename from a script_path or command string */
function extractScriptFilename(hook: HookHealthEntry): string | null {
  const src = hook.script_path ?? hook.command
  if (!src) return null
  // Remove any "# DISABLED: " prefix first
  const cleaned = src.replace(/^#\s*DISABLED:\s*/i, '')
  // Return last path segment
  const parts = cleaned.trim().split(/[\s/]/)
  const last = parts[parts.length - 1]
  return last || null
}

/** Whether a hook command is currently enabled (not prefixed with # DISABLED:) */
function isHookEnabled(hook: HookHealthEntry): boolean {
  return !hook.command.trim().startsWith('# DISABLED:')
}

function HookToggle({ hook, onToggled }: { hook: HookHealthEntry; onToggled: () => void }) {
  const [toggling, setToggling] = useState(false)
  const enabled = isHookEnabled(hook)
  const scriptFilename = extractScriptFilename(hook)

  async function handleToggle() {
    if (!scriptFilename) return
    setToggling(true)
    try {
      const res = await fetch('/api/hooks/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_filename: scriptFilename, enabled: !enabled }),
      })
      if (!res.ok) throw new Error('Toggle failed')
      onToggled()
    } catch {
      // silently fail — user can refresh to see state
    } finally {
      setToggling(false)
    }
  }

  if (!scriptFilename) return null

  return (
    <label
      className="relative inline-flex items-center cursor-pointer"
      title={enabled ? 'Disable hook' : 'Enable hook'}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${scriptFilename}`}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={handleToggle}
        disabled={toggling}
        className="sr-only peer"
        aria-label={`Toggle ${scriptFilename}`}
      />
      <div className={`
        w-8 h-4 rounded-full transition-colors
        peer-disabled:opacity-50
        ${enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)] border border-[var(--border)]'}
      `}>
        <div className={`
          absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
          ${enabled ? 'translate-x-4' : 'translate-x-0'}
          ${toggling ? 'opacity-60' : ''}
        `} />
      </div>
    </label>
  )
}

export default function HookHealthView() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch, isFetching } = useHookHealth()

  function handleToggled() {
    queryClient.invalidateQueries({ queryKey: ['hooks', 'health'] })
  }

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
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Enabled
                    </th>
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
                        <HookToggle hook={hook} onToggled={handleToggled} />
                      </td>
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
