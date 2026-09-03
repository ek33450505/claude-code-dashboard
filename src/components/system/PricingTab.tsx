import { useModelPricing } from '../../api/useCastData'

export default function PricingTab() {
  const { data: pricing, isLoading } = useModelPricing()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading pricing...</div>
  if (!pricing || Object.keys(pricing).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No pricing data. Place model-pricing.json in ~/.claude/config/.</div>
  }

  // Try to render as a table if it's a Record<model, {input, output}>
  // Support both nested { models: {...} } shape and flat shape; strip metadata keys (_comment, _note, etc.)
  const modelRecord: Record<string, unknown> =
    pricing.models && typeof pricing.models === 'object' && !Array.isArray(pricing.models)
      ? (pricing.models as Record<string, unknown>)
      : Object.fromEntries(Object.entries(pricing).filter(([k]) => !k.startsWith('_')))
  const models = Object.entries(modelRecord)

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-4">Token pricing from config/model-pricing.json ($/1M tokens)</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Model pricing">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Model</th>
              <th className="text-right pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider pr-6">Input ($/1M)</th>
              <th className="text-right pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Output ($/1M)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {models.map(([model, rates]) => {
              const r = rates as Record<string, number> | number
              const inputRate = typeof r === 'object' ? (r.cost_per_million_input ?? r.input ?? r.input_per_1m ?? '--') : '--'
              const outputRate = typeof r === 'object' ? (r.cost_per_million_output ?? r.output ?? r.output_per_1m ?? '--') : '--'
              return (
                <tr key={model} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="py-2 pr-6">
                    <span className="text-xs font-mono text-[var(--text-primary)]">{model}</span>
                  </td>
                  <td className="py-2 pr-6 text-right text-[var(--text-secondary)] tabular-nums">${String(inputRate)}</td>
                  <td className="py-2 text-right text-[var(--accent)] tabular-nums">${String(outputRate)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
