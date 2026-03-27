import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Trash2 } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQueryClient } from '@tanstack/react-query'
import { useSessions } from '../api/useSessions'
import { timeAgo, formatDuration } from '../utils/time'
import { estimateCost, formatTokens, formatCost } from '../utils/costEstimate'
import type { Session } from '../types'

function extractProjectName(projectPath: string): string {
  if (!projectPath) return 'Unknown'
  const segments = projectPath.replace(/\/+$/, '').split('/')
  return segments[segments.length - 1] || 'Unknown'
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

function ModelBadge({ model }: { model?: string }) {
  if (!model) return <span className="text-[var(--text-muted)] text-xs">—</span>
  const lower = model.toLowerCase()
  const label = lower.includes('opus') ? 'Opus'
    : lower.includes('haiku') ? 'Haiku'
    : lower.includes('sonnet') ? 'Sonnet'
    : model
  const color = lower.includes('opus')
    ? 'bg-purple-500/20 text-purple-300'
    : lower.includes('haiku')
    ? 'bg-blue-500/20 text-blue-300'
    : lower.includes('sonnet')
    ? 'bg-emerald-500/20 text-emerald-300'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

const COL_HEADERS = [
  { label: 'Project', align: 'text-left' },
  { label: 'Started', align: 'text-left' },
  { label: 'Duration', align: 'text-left' },
  { label: 'Messages', align: 'text-right' },
  { label: 'Tools', align: 'text-right' },
  { label: 'Tokens', align: 'text-right' },
  { label: 'Cost', align: 'text-right' },
  { label: 'Model', align: 'text-left' },
  { label: 'Branch', align: 'text-left' },
  { label: '', align: 'text-right' },
] as const

export default function SessionsView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sessions, isLoading, error } = useSessions(undefined, 500)
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(e: React.MouseEvent, session: Session) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete session ${session.id.slice(0, 8)}…? This cannot be undone.`)) return
    setDeletingId(session.id)
    try {
      const res = await fetch(`/api/sessions/${session.projectEncoded}/${session.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    } catch {
      alert('Failed to delete session')
    } finally {
      setDeletingId(null)
    }
  }

  const sorted = useMemo(() => {
    if (!sessions) return []
    return [...sessions].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  }, [sessions])

  // Unique project names for filter dropdown
  const projects = useMemo(() => {
    const names = new Set(sorted.map(s => extractProjectName(s.projectPath)))
    return Array.from(names).sort()
  }, [sorted])

  // Apply filters
  const filtered = useMemo(() => {
    let result = sorted
    if (projectFilter) {
      result = result.filter(s => extractProjectName(s.projectPath) === projectFilter)
    }
    if (searchQuery.length >= 2) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        extractProjectName(s.projectPath).toLowerCase().includes(q) ||
        (s.slug?.toLowerCase().includes(q)) ||
        (s.gitBranch?.toLowerCase().includes(q)) ||
        s.id.toLowerCase().includes(q)
      )
    }
    return result
  }, [sorted, projectFilter, searchQuery])

  // Aggregate stats for filtered sessions
  const totalTokens = filtered.reduce((sum, s) => sum + (s.inputTokens || 0) + (s.outputTokens || 0), 0)
  const totalCost = filtered.reduce((sum, s) => sum + estimateCost(
    s.inputTokens || 0, s.outputTokens || 0, s.cacheCreationTokens || 0, s.cacheReadTokens || 0, s.model || ''
  ), 0)

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {isLoading
              ? 'Loading sessions...'
              : `${filtered.length} session${filtered.length !== 1 ? 's' : ''} · ${formatTokens(totalTokens)} tokens · ${formatCost(totalCost)}`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search sessions"
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors"
          />
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          aria-label="Filter by project"
          className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 focus-visible:ring-1 focus-visible:ring-[var(--accent)] transition-colors"
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Failed to load sessions: {(error as Error).message}
        </div>
      )}

      {/* Mobile card list — shown below md breakpoint */}
      <div className="md:hidden space-y-3">
        {isLoading && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-4 w-1/2 rounded bg-[var(--bg-tertiary)]" />
              <div className="h-3 w-1/3 rounded bg-[var(--bg-tertiary)]" />
            </div>
          ))
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-[var(--text-muted)]">
            {searchQuery || projectFilter ? 'No matching sessions' : 'No sessions found'}
          </div>
        )}
        {!isLoading && filtered.map((session) => {
          const tokens = (session.inputTokens || 0) + (session.outputTokens || 0)
          const cost = estimateCost(
            session.inputTokens || 0,
            session.outputTokens || 0,
            session.cacheCreationTokens || 0,
            session.cacheReadTokens || 0,
            session.model || ''
          )
          return (
            <div
              key={session.id}
              onClick={() => navigate(`/sessions/${session.projectEncoded}/${session.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/sessions/${session.projectEncoded}/${session.id}`) }}
              aria-label={`Session for ${extractProjectName(session.projectPath)}, started ${timeAgo(session.startedAt)}`}
              className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-semibold text-[var(--text-primary)] text-sm truncate">
                  {extractProjectName(session.projectPath)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ModelBadge model={session.model} />
                  <button
                    onClick={(e) => handleDelete(e, session)}
                    disabled={deletingId === session.id}
                    aria-label={`Delete session ${session.id.slice(0, 8)}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                <span>{timeAgo(session.startedAt)}</span>
                {session.durationMs && <span>{formatDuration(session.durationMs)}</span>}
                <span className="text-[var(--accent)] font-medium">{tokens > 0 ? formatTokens(tokens) : '--'} tokens</span>
                <span>{cost > 0 ? formatCost(cost) : '--'}</span>
              </div>
              {session.gitBranch && (
                <div className="mt-2">
                  <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">
                    {session.gitBranch}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop table — shown at md+ */}
      <div className="hidden md:block bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border)]">
        {/* Scrollable wrapper for narrow viewports */}
        <div className="overflow-x-auto">
        {/* Sticky header row */}
        <div className="grid grid-cols-10 border-b border-[var(--border)] bg-[var(--bg-secondary)] min-w-[860px]">
          {COL_HEADERS.map(({ label, align }) => (
            <div
              key={label}
              className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] ${align}`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Scrollable virtualized body */}
        <div ref={parentRef} className="h-[600px] overflow-auto min-w-[860px]">
          {/* Loading skeleton */}
          {isLoading && (
            <table className="w-full text-sm">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          )}

          {/* Empty state */}
          {!isLoading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-[var(--text-muted)]">
              {searchQuery || projectFilter ? 'No matching sessions' : 'No sessions found'}
            </div>
          )}

          {/* Virtual rows */}
          {!isLoading && filtered.length > 0 && (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const session = filtered[virtualRow.index]
                const tokens = (session.inputTokens || 0) + (session.outputTokens || 0)
                const cost = estimateCost(
                  session.inputTokens || 0,
                  session.outputTokens || 0,
                  session.cacheCreationTokens || 0,
                  session.cacheReadTokens || 0,
                  session.model || ''
                )
                return (
                  <div
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.projectEncoded}/${session.id}`)}
                    role="row"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/sessions/${session.projectEncoded}/${session.id}`) }}
                    aria-label={`Session: ${extractProjectName(session.projectPath)}, ${timeAgo(session.startedAt)}`}
                    className="grid grid-cols-10 border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer text-sm focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="px-4 py-3 font-semibold text-[var(--text-primary)] truncate">
                      {extractProjectName(session.projectPath)}
                    </div>
                    <div className="px-4 py-3 text-[var(--text-secondary)] truncate">
                      {timeAgo(session.startedAt)}
                    </div>
                    <div className="px-4 py-3 text-[var(--text-secondary)] truncate">
                      {session.durationMs ? formatDuration(session.durationMs) : '--'}
                    </div>
                    <div className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {session.messageCount}
                    </div>
                    <div className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {session.toolCallCount}
                    </div>
                    <div className="px-4 py-3 text-right text-[var(--accent)] tabular-nums font-medium">
                      {tokens > 0 ? formatTokens(tokens) : '--'}
                    </div>
                    <div className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {cost > 0 ? formatCost(cost) : '--'}
                    </div>
                    <div className="px-4 py-3">
                      <ModelBadge model={session.model} />
                    </div>
                    <div className="px-4 py-3">
                      {session.gitBranch ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">
                          {session.gitBranch}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </div>
                    <div className="px-4 py-3 flex items-center justify-end">
                      <button
                        onClick={(e) => handleDelete(e, session)}
                        disabled={deletingId === session.id}
                        aria-label={`Delete session ${session.id.slice(0, 8)}`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </div>{/* end overflow-x-auto */}
      </div>
    </div>
  )
}
