import { useState, useMemo } from 'react'
import { FileOutput } from 'lucide-react'
import { useFileWrites, useFileWritesStats, type FileWrite } from '../api/useFileWrites'
import { timeAgo } from '../utils/time'

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-24" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-48" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-16" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-20" /></td>
          <td className="px-5 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-24" /></td>
        </tr>
      ))}
    </>
  )
}

interface StatCardProps {
  label: string
  value: number | string
  loading?: boolean
}

function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <div className="bento-card px-5 py-4 flex flex-col gap-1">
      {loading ? (
        <div className="h-7 w-16 rounded bg-[var(--bg-secondary)] animate-pulse" />
      ) : (
        <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</span>
      )}
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
    </div>
  )
}

export default function FileWritesView() {
  const [agentFilter, setAgentFilter] = useState<string>('')

  const { data: writesData, isLoading: writesLoading } = useFileWrites({ limit: 500 })
  const { data: statsData, isLoading: statsLoading } = useFileWritesStats()

  const entries: FileWrite[] = writesData?.entries ?? []
  const byAgent: Record<string, number> = statsData?.byAgent ?? {}

  const agentNames = useMemo(() => Object.keys(byAgent).sort(), [byAgent])

  const filteredEntries = useMemo(() => {
    if (!agentFilter) return entries
    return entries.filter(e => e.agent_name === agentFilter)
  }, [entries, agentFilter])

  const totalFiles = writesData?.total ?? 0
  const uniqueAgents = agentNames.length
  const uniqueSessions = useMemo(
    () => new Set(entries.map(e => e.session_id)).size,
    [entries]
  )

  const statsLoaded = !statsLoading
  const writesLoaded = !writesLoading

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <FileOutput className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">File Writes</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          File attribution per agent run
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Files Written" value={totalFiles} loading={!writesLoaded} />
        <StatCard label="Unique Agents" value={uniqueAgents} loading={!statsLoaded} />
        <StatCard label="Unique Sessions" value={uniqueSessions} loading={!writesLoaded} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="agent-filter" className="text-xs text-[var(--text-muted)] shrink-0">
          Filter by agent:
        </label>
        <select
          id="agent-filter"
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          className="text-xs rounded-lg px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          {agentNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        {agentFilter && (
          <button
            onClick={() => setAgentFilter('')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Clear agent filter"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">File Path</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Tool</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Written At</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Session</th>
              </tr>
            </thead>
            <tbody>
              {writesLoading ? (
                <SkeletonRows />
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-xs text-[var(--text-muted)]">
                    {agentFilter
                      ? `No file writes found for agent "${agentFilter}"`
                      : 'No file writes recorded yet'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => (
                  <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-5 py-2.5 text-xs font-medium text-[var(--text-primary)]">
                      {entry.agent_name || '—'}
                    </td>
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-secondary)] max-w-xs truncate" title={entry.file_path}>
                      {entry.file_path}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text-muted)]">
                      {entry.tool_name || '—'}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                      {entry.ts ? timeAgo(entry.ts) : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-xs font-mono text-[var(--text-muted)]">
                      {entry.session_id ? entry.session_id.slice(0, 12) + '…' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
