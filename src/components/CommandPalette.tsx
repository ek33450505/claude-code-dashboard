import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { Search, History, Users, Map, Brain, X } from 'lucide-react'
import { useSearch } from '../api/useSearch'
import { timeAgo } from '../utils/time'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface ResultItem {
  id: string
  category: 'session' | 'agent' | 'plan' | 'memory'
  title: string
  subtitle: string
  route: string
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  // Debounce the query
  const [debouncedQuery, setDebouncedQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isLoading } = useSearch(debouncedQuery)

  // Build flat result list
  const results: ResultItem[] = []
  if (data) {
    for (const s of data.sessions) {
      results.push({
        id: `session-${s.id}`,
        category: 'session',
        title: `${s.project} — ${s.slug || s.id.slice(0, 8)}`,
        subtitle: s.startedAt ? timeAgo(s.startedAt) : '',
        route: `/sessions/${s.projectEncoded}/${s.id}`,
      })
    }
    for (const a of data.agents) {
      results.push({
        id: `agent-${a.name}`,
        category: 'agent',
        title: a.name,
        subtitle: a.description.slice(0, 60),
        route: `/agents/${a.name}`,
      })
    }
    for (const p of data.plans) {
      results.push({
        id: `plan-${p.filename}`,
        category: 'plan',
        title: p.title || p.filename,
        subtitle: p.preview?.slice(0, 60) || '',
        route: `/knowledge/plans/${encodeURIComponent(p.filename)}`,
      })
    }
    for (const m of data.memories) {
      results.push({
        id: `memory-${m.path}`,
        category: 'memory',
        title: m.name || m.path.split('/').pop() || '',
        subtitle: m.description || m.agent,
        route: '/knowledge',
      })
    }
  }

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setDebouncedQuery('')
    }
  }, [isOpen])

  const handleSelect = useCallback((route: string) => {
    navigate(route)
    onClose()
  }, [navigate, onClose])

  const categoryIcon = (cat: ResultItem['category']) => {
    switch (cat) {
      case 'session': return <History className="w-4 h-4 text-[var(--text-muted)]" />
      case 'agent': return <Users className="w-4 h-4 text-[var(--text-muted)]" />
      case 'plan': return <Map className="w-4 h-4 text-[var(--text-muted)]" />
      case 'memory': return <Brain className="w-4 h-4 text-[var(--text-muted)]" />
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <Command
        shouldFilter={false}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        className="relative w-full max-w-2xl mx-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search sessions, agents, plans, memories..."
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none text-sm"
            autoFocus
          />
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Results */}
        <Command.List className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
              Type to search across your entire Claude Code setup
            </div>
          )}

          {isLoading && query.length >= 2 && (
            <div className="px-5 py-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          <Command.Empty>
            {query.length >= 2 && !isLoading && (
              <div className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}
          </Command.Empty>

          {results.map((item) => (
            <Command.Item
              key={item.id}
              value={item.id}
              onSelect={() => handleSelect(item.route)}
              className="flex items-center gap-3 px-5 py-2.5 text-left text-[var(--text-secondary)] transition-colors cursor-default data-[selected=true]:bg-[var(--accent-subtle)] data-[selected=true]:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              {categoryIcon(item.category)}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-[var(--text-muted)] truncate">{item.subtitle}</div>
              </div>
              <span className="text-xs text-[var(--text-muted)] capitalize shrink-0">{item.category}</span>
            </Command.Item>
          ))}
        </Command.List>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">↵</kbd> open</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">esc</kbd> close</span>
        </div>
      </Command>
    </div>
  )
}
