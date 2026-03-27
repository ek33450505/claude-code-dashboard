import { useState, useMemo, useCallback } from 'react'
import { Brain, Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useAgentMemoriesDb, useDeleteMemory } from '../api/useAgentMemoriesDb'

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  user: { bg: 'rgba(0,255,194,0.15)', text: '#00FFC2' },
  feedback: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  project: { bg: 'rgba(96,165,250,0.15)', text: '#60A5FA' },
  reference: { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize" style={{ backgroundColor: c.bg, color: c.text }}>
      {type}
    </span>
  )
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function MemoryBrowserView() {
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const q = useDebounce(searchInput, 300)
  const params = useMemo(() => ({
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(agentFilter ? { agent: agentFilter } : {}),
    ...(q ? { q } : {}),
  }), [typeFilter, agentFilter, q])

  const { data, isLoading, error } = useAgentMemoriesDb(params)
  const deleteMemory = useDeleteMemory(params)

  const agentList = useMemo(() => {
    if (!data?.memories) return []
    return [...new Set(data.memories.map(m => m.agent))].sort()
  }, [data])

  const typeList = ['user', 'feedback', 'project', 'reference']

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete memory "${name}"?`)) {
      deleteMemory.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bento-card p-5 h-32 animate-pulse bg-[var(--bg-secondary)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bento-card p-6 text-[var(--error)]">Failed to load memories.</div>
      </div>
    )
  }

  const memories = data?.memories ?? []
  const total = data?.total ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Memory Browser</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">{total} memories in cast.db</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search memories..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {typeList.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(prev => prev === t ? '' : t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                typeFilter === t
                  ? 'bg-[var(--accent)] text-[#070A0F] border-[var(--accent)]'
                  : 'border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {agentList.length > 0 && (
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All agents</option>
            {agentList.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {memories.length === 0 ? (
        <div className="bento-card p-10 text-center text-[var(--text-muted)]">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No memories found</div>
          <div className="text-sm mt-1">Agent memories stored in cast.db will appear here</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {memories.map(mem => {
            const isExpanded = expanded.has(mem.id)
            return (
              <div key={mem.id} className="bento-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-sm text-[var(--text-primary)] truncate">{mem.name}</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TypeBadge type={mem.type} />
                      <span className="text-xs text-[var(--text-muted)]">{mem.agent}</span>
                      {mem.project && (
                        <span className="text-xs text-[var(--text-muted)]">· {mem.project}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(mem.id, mem.name)}
                    disabled={deleteMemory.isPending}
                    className="shrink-0 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[rgba(251,113,133,0.1)] transition-colors disabled:opacity-50"
                    title="Delete memory"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  className="text-xs text-[var(--text-secondary)] cursor-pointer"
                  onClick={() => toggleExpand(mem.id)}
                >
                  {isExpanded ? mem.content : `${mem.content.slice(0, 200)}${mem.content.length > 200 ? '...' : ''}`}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-muted)]">
                    Updated {new Date(mem.updated_at).toLocaleDateString()}
                  </span>
                  {mem.content.length > 200 && (
                    <button
                      onClick={() => toggleExpand(mem.id)}
                      className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80"
                    >
                      {isExpanded ? <><ChevronUp className="w-3 h-3" /> Collapse</> : <><ChevronDown className="w-3 h-3" /> Expand</>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
