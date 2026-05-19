import { useState } from 'react'
import { Brain } from 'lucide-react'
import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import type { MemoryFile } from '../types'
import { timeAgo } from '../utils/time'

type MemoryType = 'user' | 'feedback' | 'project' | 'reference'
type MemorySource = 'agent' | 'project'

function typeBadgeClasses(type: string | undefined): string {
  switch (type as MemoryType) {
    case 'user':
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
    case 'feedback':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
    case 'project':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
    case 'reference':
      return 'bg-purple-500/10 text-purple-400 border border-purple-500/25'
    default:
      return 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--glass-border)]'
  }
}

function SkeletonRows() {
  return (
    <div className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="px-4 py-3 animate-pulse flex items-start gap-3">
          <div className="h-5 w-16 rounded bg-[var(--bg-secondary)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 rounded bg-[var(--bg-secondary)]" style={{ width: `${55 + i * 7}%` }} />
            <div className="h-3 rounded bg-[var(--bg-secondary)]" style={{ width: `${35 + i * 5}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

interface MemoryRowProps {
  mem: MemoryFile
  onClick: (mem: MemoryFile) => void
}

function MemoryRow({ mem, onClick }: MemoryRowProps) {
  const label = mem.name || mem.filename || mem.path.split('/').at(-1) || ''
  return (
    <button
      type="button"
      className="w-full text-left px-4 py-3 hover:bg-[var(--accent-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px] transition-colors"
      style={{ minHeight: '44px' }}
      onClick={() => onClick(mem)}
    >
      <div className="flex items-start gap-3">
        {mem.type && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium mt-0.5 ${typeBadgeClasses(mem.type)}`}>
            {mem.type}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {label}
            </p>
            <span className="shrink-0 text-xs text-[var(--text-muted)]">
              {timeAgo(mem.lastModified)}
            </span>
          </div>
          {mem.description && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {mem.description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

interface MemoryDetailModalProps {
  mem: MemoryFile
  onClose: () => void
}

function MemoryDetailModal({ mem, onClose }: MemoryDetailModalProps) {
  const label = mem.name || mem.filename || mem.path.split('/').at(-1) || ''
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bento-card max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
          <div className="flex items-center gap-2 min-w-0">
            {mem.type && (
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${typeBadgeClasses(mem.type)}`}>
                {mem.type}
              </span>
            )}
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{label}</span>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 ml-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded hover:bg-[var(--accent-subtle)] transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          <p className="text-[10px] text-[var(--text-muted)] font-mono mb-3">{mem.path}</p>
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
            {mem.body}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function MemoryView() {
  const { data: agentMem, isLoading: loadingAgent, error: agentError } = useAgentMemory()
  const { data: projectMem, isLoading: loadingProject, error: projectError } = useProjectMemory()
  const [selectedMem, setSelectedMem] = useState<MemoryFile | null>(null)
  const [source, setSource] = useState<MemorySource>('agent')

  const isLoading = loadingAgent || loadingProject
  const error = agentError || projectError

  const memories = source === 'agent' ? (agentMem ?? []) : (projectMem ?? [])

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Brain className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Memory</h1>
          <p className="text-sm mt-0.5 text-[var(--text-muted)]">Agent and project memory files</p>
        </div>
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {memories.length} entr{memories.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      {/* Source toggle */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit">
        {(['agent', 'project'] as MemorySource[]).map(s => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              source === s
                ? 'bg-[var(--accent)] text-[#070A0F] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s === 'agent' ? 'Agent Memory' : 'Project Memory'}
          </button>
        ))}
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div role="alert" className="bento-card p-4 text-sm text-[var(--text-muted)]">
          Failed to load memory files.
        </div>
      )}

      {!isLoading && !error && memories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Brain className="w-10 h-10 opacity-20 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-sm text-[var(--text-muted)]">No memory files found</p>
        </div>
      )}

      {!isLoading && !error && memories.length > 0 && (
        <div className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]">
          {memories.map(mem => (
            <MemoryRow key={mem.path} mem={mem} onClick={setSelectedMem} />
          ))}
        </div>
      )}

      {selectedMem && (
        <MemoryDetailModal mem={selectedMem} onClose={() => setSelectedMem(null)} />
      )}
    </div>
  )
}
