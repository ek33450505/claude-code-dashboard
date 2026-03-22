import { useRoutingRules } from '../../api/useRouting'
import type { RoutingRule } from '../../types'

interface RoutingCategoryProps {
  onViewFile: (title: string, body: string) => void
}

export default function RoutingCategory({ onViewFile }: RoutingCategoryProps) {
  const { data: rules } = useRoutingRules()

  if (!rules || rules.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No routing rules configured</p>
  }

  return (
    <div className="grid gap-2">
      {rules.map((rule: RoutingRule) => (
        <button
          key={rule.agent}
          onClick={() => {
            const body = [
              `# ${rule.agent}`,
              '',
              `**Command:** \`${rule.command}\``,
              '',
              `## Patterns (${rule.patterns.length})`,
              '',
              ...rule.patterns.map(p => `- \`${p}\``),
              '',
              ...(rule.postChain && rule.postChain.length > 0
                ? ['## Post-Chain Agents', '', ...rule.postChain.map(a => `- ${a}`)]
                : []),
            ].join('\n')
            onViewFile(`Routing: ${rule.agent}`, body)
          }}
          className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-semibold text-[var(--text-primary)] block truncate">{rule.agent}</span>
                <span className="text-xs text-[var(--text-muted)] font-mono">{rule.command}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--accent)]/20 text-[var(--accent)]">
                {rule.patterns.length} pattern{rule.patterns.length !== 1 ? 's' : ''}
              </span>
              {rule.postChain && rule.postChain.length > 0 && (
                <div className="flex gap-1">
                  {rule.postChain.map(agent => (
                    <span key={agent} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                      {agent}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
