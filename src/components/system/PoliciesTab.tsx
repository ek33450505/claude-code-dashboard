import { usePolicies } from '../../api/useCastData'

export default function PoliciesTab() {
  const { data: policies, isLoading } = usePolicies()

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading policies...</div>
  if (!policies || Object.keys(policies).length === 0) {
    return <div className="p-6 text-[var(--text-muted)]">No policies found. Place policies.json in ~/.claude/config/.</div>
  }

  return (
    <div>
      <p className="text-xs text-[var(--text-muted)] mb-4">Policy rules from config/policies.json</p>
      <pre className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-xs overflow-x-auto whitespace-pre-wrap max-h-96 text-[var(--text-secondary)]">
        {JSON.stringify(policies, null, 2)}
      </pre>
    </div>
  )
}
