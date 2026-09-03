import { Zap } from 'lucide-react'
import { useChartColors } from '../../lib/useChartColors'
import type { DelegationSavings } from '../../api/useAnalytics'

const PIXEL_FONT = { fontFamily: "'Press Start 2P', monospace" }

function PixelBar({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  const filled = Math.round(pct / 10)
  const empty = 10 - filled
  return (
    <span style={{ ...PIXEL_FONT, fontSize: 8, letterSpacing: 1 }}>
      <span style={{ color }}>{'█'.repeat(filled)}</span>
      <span style={{ color: bg }}>{'░'.repeat(empty)}</span>
    </span>
  )
}

export default function DelegationSavingsPanel({ savings }: { savings: DelegationSavings }) {
  const c = useChartColors()
  const total = savings.dispatches.haiku + savings.dispatches.sonnet + savings.dispatches.opus
  const haikuPct = total > 0 ? Math.round((savings.dispatches.haiku / total) * 100) : 0
  const sonnetPct = total > 0 ? Math.round((savings.dispatches.sonnet / total) * 100) : 0
  const opusPct = total > 0 ? Math.round((savings.dispatches.opus / total) * 100) : 0

  return (
    <div
      className="bento-card p-6"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), var(--bg-secondary)',
        border: '2px solid rgba(0,255,194,0.15)',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
          <Zap className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div>
          <h2 style={{ ...PIXEL_FONT, fontSize: 9, color: c.mint, lineHeight: 2 }}>
            DELEGATION SAVINGS
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Haiku dispatch vs all-sonnet baseline</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Savings + Haiku util */}
        <div className="space-y-5">
          {/* Saved amount */}
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">SAVED VS ALL-SONNET</div>
            <div style={{ ...PIXEL_FONT, fontSize: 14, color: c.mint, lineHeight: 2 }}>
              ${savings.savedUSD.toFixed(4)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              actual ${savings.actualCostUSD.toFixed(4)} · baseline ${savings.hypotheticalSonnetCostUSD.toFixed(4)}
            </div>
          </div>

          {/* Haiku utilization */}
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-2">HAIKU UTIL</div>
            <div className="flex items-center gap-3">
              <PixelBar pct={savings.haikuUtilizationPct} color={c.blue} bg={c.barTrack} />
              <span style={{ ...PIXEL_FONT, fontSize: 8, color: c.blue }}>
                {savings.haikuUtilizationPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Right: Per-model dispatch chips */}
        <div>
          <div className="text-xs text-[var(--text-muted)] mb-3">MODEL DISPATCH SPLIT</div>
          <div className="space-y-3">
            {[
              { label: 'HAIKU', count: savings.dispatches.haiku, pct: haikuPct, color: c.blue },
              { label: 'SONNET', count: savings.dispatches.sonnet, pct: sonnetPct, color: c.mint },
              { label: 'OPUS', count: savings.dispatches.opus, pct: opusPct, color: c.purple },
            ].map(({ label, count, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded"
                  style={{ ...PIXEL_FONT, fontSize: 6, color, background: `${color}15`, minWidth: 52, textAlign: 'center' }}
                >
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
