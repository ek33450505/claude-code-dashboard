import { useHookDefinitions } from '../../api/useHooks'
import type { HookDefinition } from '../../types'

interface HooksCategoryProps {
  onViewFile: (title: string, body: string) => void
}

function eventBadgeColor(event: string): string {
  switch (event) {
    case 'PreToolUse': return 'bg-amber-500/20 text-amber-400'
    case 'PostToolUse': return 'bg-blue-500/20 text-blue-400'
    case 'UserPromptSubmit': return 'bg-purple-500/20 text-purple-400'
    case 'Stop': return 'bg-red-500/20 text-red-400'
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
  }
}

function groupByEvent(hooks: HookDefinition[]): Record<string, HookDefinition[]> {
  const result: Record<string, HookDefinition[]> = {}
  for (const hook of hooks) {
    if (!result[hook.event]) result[hook.event] = []
    result[hook.event].push(hook)
  }
  return result
}

export default function HooksCategory({ onViewFile }: HooksCategoryProps) {
  const { data: hooks } = useHookDefinitions()

  if (!hooks || hooks.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No hooks configured</p>
  }

  const grouped = groupByEvent(hooks)

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([event, eventHooks]) => (
        <div key={event}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${eventBadgeColor(event)}`}>
              {event}
            </span>
            <span className="text-[var(--text-muted)]">{eventHooks.length}</span>
          </h4>
          <div className="grid gap-2">
            {eventHooks.map((hook, i) => (
              <button
                key={`${hook.event}-${hook.matcher || ''}-${i}`}
                onClick={() => {
                  const body = [
                    `# Hook: ${hook.event}${hook.matcher ? ` (${hook.matcher})` : ''}`,
                    '',
                    `**Event:** ${hook.event}`,
                    `**Type:** ${hook.type}`,
                    ...(hook.matcher ? [`**Matcher:** \`${hook.matcher}\``] : []),
                    ...(hook.command ? [`**Command:** \`${hook.command}\``] : []),
                    ...(hook.description ? [``, `## Description`, '', hook.description] : []),
                    ...(hook.timeout ? [``, `**Timeout:** ${hook.timeout}ms`] : []),
                  ].join('\n')
                  onViewFile(`Hook: ${hook.event}`, body)
                }}
                className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                        {hook.type}
                      </span>
                      {hook.matcher && (
                        <span className="text-xs font-mono text-[var(--accent)]">{hook.matcher}</span>
                      )}
                    </div>
                    {hook.command && (
                      <span className="text-xs text-[var(--text-muted)] font-mono truncate block">{hook.command}</span>
                    )}
                    {hook.description && (
                      <span className="text-xs text-[var(--text-muted)] mt-1 block">{hook.description}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
