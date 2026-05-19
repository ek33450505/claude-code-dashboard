import { Webhook } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { HookDefinition } from '../types'

async function fetchHooks(): Promise<HookDefinition[]> {
  const res = await fetch('/api/hooks')
  if (!res.ok) throw new Error('Failed to fetch hooks')
  return res.json()
}

function useHooks() {
  return useQuery({ queryKey: ['hooks'], queryFn: fetchHooks, staleTime: 30_000 })
}

function groupByEvent(hooks: HookDefinition[]): Map<string, HookDefinition[]> {
  const map = new Map<string, HookDefinition[]>()
  for (const hook of hooks) {
    if (!map.has(hook.event)) map.set(hook.event, [])
    map.get(hook.event)!.push(hook)
  }
  return map
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="h-12 rounded animate-pulse bg-[var(--bg-secondary)]"
          style={{ width: `${90 - i * 5}%` }}
        />
      ))}
    </div>
  )
}

export default function HooksView() {
  const { data: hooks = [], isLoading, error } = useHooks()
  const grouped = groupByEvent(hooks)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Webhook className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Hooks</h1>
          <p className="text-sm mt-0.5 text-[var(--text-muted)]">
            Claude Code event hooks registered in ~/.claude/settings.json
          </p>
        </div>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {hooks.length} hook{hooks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div
          role="alert"
          className="bento-card p-4 text-sm text-[var(--text-muted)]"
        >
          Failed to load hooks.
        </div>
      )}

      {!isLoading && !error && hooks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Webhook className="w-10 h-10 opacity-20 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--text-muted)]">No hooks configured</p>
        </div>
      )}

      {!isLoading && !error && hooks.length > 0 && (
        <div className="space-y-6">
          {[...grouped.entries()].map(([event, eventHooks]) => (
            <section key={event} aria-label={`${event} hooks`}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-[var(--text-secondary)]">
                  {event}
                </h2>
                <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                  {eventHooks.length}
                </span>
              </div>
              <div className="bento-card overflow-hidden">
                {eventHooks.map((hook, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-3 min-h-[44px]"
                    style={{
                      borderBottom: i < eventHooks.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    }}
                  >
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded font-mono font-medium mt-0.5 border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {hook.type}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm text-[var(--text-primary)] truncate"
                        title={hook.command ?? hook.description ?? ''}
                      >
                        {hook.command ?? hook.description ?? '—'}
                      </p>
                      {hook.matcher && (
                        <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          matcher: {hook.matcher}
                        </p>
                      )}
                    </div>
                    {hook.timeout && (
                      <span className="shrink-0 text-xs text-[var(--text-muted)]">
                        {hook.timeout}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
