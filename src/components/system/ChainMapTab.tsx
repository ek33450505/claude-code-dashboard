import { useChainMap } from '../../api/useCastData'

export default function ChainMapTab() {
  const { data: chainMap, isLoading } = useChainMap()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading chain map...</div>
  if (!chainMap || Object.keys(chainMap).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No chain map found. Place chain-map.json in ~/.claude/config/.</div>
  }

  const entries = Object.entries(chainMap).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--text-muted)] mb-4">Agent dispatch chain definitions from config/chain-map.json</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Registered agents">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Agent</th>
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Successors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {entries.map(([agent, successors]) => (
              <tr key={agent} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                <td className="py-2 pr-6">
                  <span className="text-xs font-mono text-[var(--text-primary)]">{agent}</span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(successors) && successors.map((s: string) => (
                      <span
                        key={s}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
                      >
                        {s}
                      </span>
                    ))}
                    {(!Array.isArray(successors) || successors.length === 0) && (
                      <span className="text-xs text-[var(--text-muted)]">--</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
