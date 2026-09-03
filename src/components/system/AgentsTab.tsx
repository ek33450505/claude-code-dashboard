import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAgents, useAgent } from '../../api/useAgents'

function AgentDetailInline({ name }: { name: string }) {
  const { data, isLoading } = useAgent({ name })
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-xs space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-[var(--text-primary)]">{data.name}</span>
        <span className="text-[var(--text-muted)]">{data.model}</span>
        {data.color && (
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        )}
      </div>
      <p className="text-[var(--text-secondary)]">{data.description}</p>
      {data.body && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[var(--accent)] hover:underline">View full definition</summary>
          <pre className="mt-2 p-3 bg-[var(--bg-primary)] rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-80">
            {data.body}
          </pre>
        </details>
      )}
    </div>
  )
}

export default function AgentsTab() {
  const { data: agents, isLoading } = useAgents()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading agents...</div>
  if (!agents || agents.length === 0) return <div className="p-6 text-[var(--text-muted)]">No agents found.</div>

  return (
    <div className="space-y-1">
      {agents.map(agent => (
        <div key={agent.name} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === agent.name ? null : agent.name)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === agent.name
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <span className="font-medium text-sm text-[var(--text-primary)]">{agent.name}</span>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{agent.model}</span>
          </button>
          {expanded === agent.name && <AgentDetailInline name={agent.name} />}
        </div>
      ))}
    </div>
  )
}
