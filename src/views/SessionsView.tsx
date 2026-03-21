import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
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
      {Array.from({ length: 9 }).map((_, i) => (
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

export default function SessionsView() {
  const navigate = useNavigate()
  const { data: sessions, isLoading, error } = useSessions(undefined, 100)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('')

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
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
          />
        </div>
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
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

      {/* Table */}
      <div className="bg-[var(--bg-secondary)] rounded-xl overflow-hidden border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Project
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Messages
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tools
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Tokens
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cost
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Branch
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-[var(--text-muted)]"
                  >
                    {searchQuery || projectFilter ? 'No matching sessions' : 'No sessions found'}
                  </td>
                </tr>
              )}

              {filtered.map((session: Session) => {
                const tokens = (session.inputTokens || 0) + (session.outputTokens || 0)
                const cost = estimateCost(
                  session.inputTokens || 0,
                  session.outputTokens || 0,
                  session.cacheCreationTokens || 0,
                  session.cacheReadTokens || 0,
                  session.model || ''
                )
                return (
                  <tr
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.projectEncoded}/${session.id}`)}
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {extractProjectName(session.projectPath)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {timeAgo(session.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {session.durationMs ? formatDuration(session.durationMs) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {session.messageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {session.toolCallCount}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--accent)] tabular-nums font-medium">
                      {tokens > 0 ? formatTokens(tokens) : '--'}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {cost > 0 ? formatCost(cost) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <ModelBadge model={session.model} />
                    </td>
                    <td className="px-4 py-3">
                      {session.gitBranch ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">
                          {session.gitBranch}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">--</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
