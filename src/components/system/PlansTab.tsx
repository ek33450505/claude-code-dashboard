import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { usePlans, usePlan } from '../../api/usePlans'

function PlanDetailInline({ filename }: { filename: string }) {
  const { data, isLoading } = usePlan({ filename })
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <pre className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap max-h-96">
      {data.body}
    </pre>
  )
}

export default function PlansTab() {
  const { data: plans, isLoading } = usePlans()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading plans...</div>
  if (!plans || plans.length === 0) return <div className="p-6 text-[var(--text-muted)]">No plans found.</div>

  return (
    <div className="space-y-1">
      {plans.map(plan => (
        <div key={plan.filename} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === plan.filename ? null : plan.filename)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === plan.filename
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm text-[var(--text-primary)] block truncate">{plan.title || plan.filename}</span>
              {plan.date && <span className="text-xs text-[var(--text-muted)]">{plan.date}</span>}
            </div>
          </button>
          {expanded === plan.filename && <PlanDetailInline filename={plan.filename} />}
        </div>
      ))}
    </div>
  )
}
