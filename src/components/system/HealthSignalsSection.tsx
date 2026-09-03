import { AlertTriangle } from 'lucide-react'
import { useAgentTruncations } from '../../api/useAgentTruncations'

export default function HealthSignalsSection() {
  const { data: truncData } = useAgentTruncations()

  const truncations = (truncData?.truncations ?? []).slice(0, 10)

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="mt-8 space-y-4">
      <h2 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" />
        Health Signals
      </h2>
      <p className="text-xs text-[var(--text-muted)]">Agent truncations — more signals land here as they come online.</p>
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Agent truncations">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Time</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Agent Type</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Chars</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--text-muted)]">Last Line</th>
              </tr>
            </thead>
            <tbody>
              {truncations.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">No agent truncations</td>
                </tr>
              ) : truncations.map(t => (
                <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{fmtTime(t.timestamp)}</td>
                  <td className="px-3 py-2 text-[var(--text-primary)]">{t.agent_type}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{t.char_count ?? '—'}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[140px]" title={t.last_line ?? undefined}>{t.last_line ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
