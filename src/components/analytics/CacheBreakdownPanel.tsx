import { Activity } from 'lucide-react'
import { useChartColors } from '../../lib/useChartColors'
import { formatTokens, formatCost } from '../../../shared/format.js'
import { getRates, cacheReadMultiplier } from '../../../shared/pricing.js'

/**
 * The model whose rates the cache-savings figure is quoted at. Pinned and disclosed in the UI.
 * The `as const` + keyed Record makes the label a COMPILE error if this constant changes without
 * the map — otherwise the disclosure silently renders "at undefined rates" to the user.
 */
const CACHE_SAVINGS_BASELINE_MODEL = 'claude-sonnet-5' as const
const MODEL_LABELS: Record<typeof CACHE_SAVINGS_BASELINE_MODEL, string> = {
  'claude-sonnet-5': 'Sonnet 5',
}

export default function CacheBreakdownPanel({ totalCacheCreationTokens, totalCacheReadTokens }: { totalCacheCreationTokens: number; totalCacheReadTokens: number }) {
  const c = useChartColors()
  const total = totalCacheCreationTokens + totalCacheReadTokens
  const hitRatio = total > 0 ? Math.round((totalCacheReadTokens / total) * 100) : 0

  // Cache savings = what these reads would have cost at full input rate, minus what they did
  // cost at the cache-read rate. This panel only receives token totals, not the model mix, so
  // the figure is necessarily quoted at ONE model's rates — say which, rather than implying
  // exactness. Rates come from shared/pricing.ts; they used to be hardcoded here as $3.00/$0.30,
  // which silently priced every cached token as Sonnet 4.6 and overstated the saving by ~50%.
  const baseline = getRates(CACHE_SAVINGS_BASELINE_MODEL)
  const cacheReadRatePerM = baseline.input * cacheReadMultiplier(CACHE_SAVINGS_BASELINE_MODEL)
  const cacheSavingsUSD = (totalCacheReadTokens * (baseline.input - cacheReadRatePerM)) / 1_000_000

  const creationPct = total > 0 ? Math.round((totalCacheCreationTokens / total) * 100) : 0
  const readPct = total > 0 ? Math.round((totalCacheReadTokens / total) * 100) : 0

  return (
    <div
      className="bento-card p-6"
      style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), var(--bg-secondary)',
        border: '2px solid rgba(96,165,250,0.15)',
      }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Activity className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h2 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: c.blue, lineHeight: 2 }}>
            CACHE EFFICIENCY
          </h2>
          <p className="text-xs text-[var(--text-muted)]">Prompt cache creation vs read ratio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">HIT RATIO</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: c.blue, lineHeight: 2 }}>
              {hitRatio}%
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {formatTokens(totalCacheReadTokens)} reads · {formatTokens(totalCacheCreationTokens)} writes
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)] mb-1">CACHE SAVINGS</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 11, color: c.mint, lineHeight: 2 }}>
              {formatCost(cacheSavingsUSD)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              vs full input rate, at {MODEL_LABELS[CACHE_SAVINGS_BASELINE_MODEL]} rates
            </div>
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--text-muted)] mb-3">TOKEN BREAKDOWN</div>
          <div className="space-y-3">
            {[
              { label: 'CACHE WRITE', count: totalCacheCreationTokens, pct: creationPct, color: c.amber },
              { label: 'CACHE READ', count: totalCacheReadTokens, pct: readPct, color: c.mint },
            ].map(({ label, count, pct, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span
                  className="px-2 py-1 rounded"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color, background: `${color}15`, minWidth: 72, textAlign: 'center' }}
                >
                  {label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] w-14 text-right">{formatTokens(count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
