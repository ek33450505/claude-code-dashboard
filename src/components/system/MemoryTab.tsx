import { Brain } from 'lucide-react'
import { useAgentMemory, useProjectMemory } from '../../api/useMemory'

export default function MemoryTab() {
  const { data: agentMem, isLoading: loadingAgent } = useAgentMemory()
  const { data: projectMem, isLoading: loadingProject } = useProjectMemory()

  if (loadingAgent || loadingProject) return <div className="p-6 text-[var(--text-muted)]">Loading memory...</div>

  const allMemories = [
    ...(agentMem ?? []).map(m => ({ ...m, source: 'agent' as const })),
    ...(projectMem ?? []).map(m => ({ ...m, source: 'project' as const })),
  ]

  if (allMemories.length === 0) return <div className="p-6 text-[var(--text-muted)]">No memory files found in agent-memory-local/.</div>

  return (
    <div className="space-y-2">
      {allMemories.map((mem, i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="font-mono text-sm text-[var(--text-primary)]">{mem.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              {mem.source}
            </span>
          </div>
          {mem.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 ml-7">{mem.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
