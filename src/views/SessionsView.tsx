import { useNavigate } from 'react-router-dom'
import { useSessions } from '../api/useSessions'
import { timeAgo, formatDuration } from '../utils/time'
import type { Session } from '../types'

function extractProjectName(projectPath: string): string {
  if (!projectPath) return 'Unknown'
  const segments = projectPath.replace(/\/+$/, '').split('/')
  return segments[segments.length - 1] || 'Unknown'
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[var(--border)]">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export default function SessionsView() {
  const navigate = useNavigate()
  const { data: sessions, isLoading, error } = useSessions(undefined, 50)

  const sorted = sessions
    ? [...sessions].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          {isLoading
            ? 'Loading sessions...'
            : `${sorted.length} session${sorted.length !== 1 ? 's' : ''}`}
        </p>
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
                  Tool Calls
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Agents
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Branch
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-[var(--text-muted)]"
                  >
                    No sessions found
                  </td>
                </tr>
              )}

              {sorted.map((session: Session) => (
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
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)] tabular-nums">
                      {session.agentCount}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
