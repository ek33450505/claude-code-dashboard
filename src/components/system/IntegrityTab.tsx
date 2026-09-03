import { HardDrive, Database, Gauge } from 'lucide-react'
import { useSystemIntegrity } from '../../api/useSystemIntegrity'
import { useRateLimits } from '../../api/useRateLimits'
import StatusPill from '../StatusPill'
import { timeAgo } from '../../../shared/time.js'

function RateGauge({ label, used, limit }: { label: string; used: number | null; limit: number | null }) {
  const pct = used != null && limit ? Math.min(100, Math.round((used / limit) * 100)) : null
  const tone = pct == null
    ? 'bg-[var(--text-muted)]'
    : pct >= 90 ? 'bg-rose-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[var(--accent)]'
  return (
    <div className="bento-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
        <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
          {used?.toLocaleString() ?? '—'} / {limit?.toLocaleString() ?? '—'}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct ?? 0}%` }} />
      </div>
      {pct != null && <span className="text-xs text-[var(--text-muted)]">{pct}% used</span>}
    </div>
  )
}

export default function IntegrityTab() {
  const { data: integrity, isLoading } = useSystemIntegrity()
  const { data: rl } = useRateLimits()
  const latest = rl?.latest ?? null
  const ls = integrity?.litestream
  const snap = integrity?.snapshots

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Data Integrity (Pillar 2)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bento-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Litestream replication</span>
            </div>
            {isLoading ? (
              <div className="h-5 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
            ) : (
              <div className="flex items-center gap-3">
                <StatusPill
                  status={ls?.active ? 'active' : 'inactive'}
                  tone={ls?.active ? 'success' : 'danger'}
                  pulse={false}
                  label={ls?.active ? 'Replicating' : 'Inactive'}
                />
                {ls?.seq != null && <span className="text-xs font-mono text-[var(--text-muted)]">seq {ls.seq}</span>}
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)]">Continuous replication outside the ~/.claude blast radius.</p>
          </div>

          <div className="bento-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Dated snapshots</span>
            </div>
            {isLoading ? (
              <div className="h-5 w-24 rounded bg-[var(--bg-secondary)] animate-pulse" />
            ) : snap && snap.count > 0 ? (
              <div className="space-y-0.5">
                <div className="text-sm text-[var(--text-primary)]">
                  <span className="font-mono tabular-nums">{snap.count}</span> snapshots
                </div>
                <div className="text-xs text-[var(--text-muted)]">last {snap.lastBackupAt ? timeAgo(snap.lastBackupAt) : '—'}</div>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No snapshots found.</p>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Anthropic Rate Limits</h2>
        {latest ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RateGauge label="Tokens / min" used={latest.tpm_used} limit={latest.tpm_limit} />
            <RateGauge label="Requests / min" used={latest.rpm_used} limit={latest.rpm_limit} />
          </div>
        ) : (
          <div className="bento-card p-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="text-sm text-[var(--text-muted)]">No rate-limit snapshots yet — populated by <code className="font-mono">cast-rate-check.py</code>.</span>
          </div>
        )}
      </div>
    </div>
  )
}
