import { useRules } from '../../api/useKnowledge'

export default function RulesTab() {
  const { data: rules, isLoading } = useRules()
  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading rules...</div>
  if (!rules || rules.length === 0) return <div className="p-6 text-[var(--text-muted)]">No rules found.</div>

  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div key={rule.filename} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-[var(--text-primary)]">{rule.filename}</span>
            <span className="text-xs text-[var(--text-muted)]">{new Date(rule.modifiedAt).toLocaleDateString()}</span>
          </div>
          {rule.preview && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{rule.preview}</p>
          )}
        </div>
      ))}
    </div>
  )
}
