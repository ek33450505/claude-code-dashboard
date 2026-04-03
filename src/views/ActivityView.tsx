import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveAgents } from '../api/useActiveAgents'
import { useRecentSessions } from '../api/useSessionAgents'
import { useLiveEvents } from '../api/useLive'
import type { AgentRun } from '../api/useAgentRuns'
import type { LiveEvent, PastSessionSummary } from '../types'
import { formatCost } from '../utils/costEstimate'
import { timeAgo } from '../utils/time'

import ActivityStatusBar from '../components/Activity/ActivityStatusBar'
import AgentRunCard from '../components/Activity/AgentRunCard'
import AgentRunDetail from '../components/Activity/AgentRunDetail'
import DispatchHistory from '../components/Activity/DispatchHistory'
import StatusPill from '../components/Activity/StatusPill'

// ─── Past Session Accordion Item ─────────────────────────────────────────────

function PastSessionItem({ session }: { session: PastSessionSummary }) {
  const costStr = session.totalCost > 0 ? formatCost(session.totalCost) : null

  return (
    <details className="group border border-[var(--glass-border)] rounded-lg overflow-hidden">
      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none bg-[var(--bg-secondary)] hover:bg-white/[0.03] transition-colors list-none">
        {/* Chevron */}
        <svg
          className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform group-open:rotate-90"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>

        {/* Session info */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {timeAgo(session.startedAt)}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-primary)] text-[var(--text-muted)]">
            {session.agentCount} agent{session.agentCount !== 1 ? 's' : ''}
          </span>
          {costStr && (
            <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">{costStr}</span>
          )}
        </div>
      </summary>

      {/* Agent list */}
      <div className="px-3 pb-3 pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-[var(--bg-primary)]/40">
        {session.agents.map((agent) => (
          <div key={agent.id} className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">{agent.agent}</span>
                <StatusPill status={agent.status} />
              </div>
              {agent.task_summary && (
                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{agent.task_summary}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </details>
  )
}

// ─── Activity View ────────────────────────────────────────────────────────────

export default function ActivityView() {
  const queryClient = useQueryClient()
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // Data hooks
  const { data: activeData, isLoading: activeLoading } = useActiveAgents()
  const { data: sessionsData, isLoading: sessionsLoading } = useRecentSessions(10)

  const activeRuns: AgentRun[] = activeData ?? []
  const pastSessions: PastSessionSummary[] = sessionsData?.sessions ?? []

  // SSE — invalidate react-query caches on DB change events
  const handleLiveEvent = useCallback(
    (event: LiveEvent) => {
      if (event.type === 'db_change_agent_run') {
        queryClient.invalidateQueries({ queryKey: ['cast', 'active-agents'] })
        queryClient.invalidateQueries({ queryKey: ['cast', 'recent-sessions'] })
      }
    },
    [queryClient]
  )

  useLiveEvents(handleLiveEvent)

  const hasDetail = selectedRun !== null

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Status bar — self-contained, manages own data and SSE state */}
      <ActivityStatusBar />

      {/* Main body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left / main column */}
        <div className={`flex flex-col flex-1 min-w-0 overflow-y-auto p-4 gap-6 ${hasDetail ? 'lg:max-w-[calc(100%-320px)]' : ''}`}>

          {/* Current Session */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Current Session
            </h2>

            {activeLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                ))}
              </div>
            ) : activeRuns.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 py-10">
                <p className="text-sm text-[var(--text-muted)]">No agents currently running</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {activeRuns.map((run) => (
                  <AgentRunCard
                    key={run.id}
                    run={run}
                    selected={selectedRun?.id === run.id}
                    onClick={() =>
                      setSelectedRun((prev) => (prev?.id === run.id ? null : run))
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* Past Sessions */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
              Past Sessions
            </h2>

            {sessionsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
                ))}
              </div>
            ) : pastSessions.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4 text-center">No past sessions today</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pastSessions.map((session) => (
                  <PastSessionItem key={session.sessionId} session={session} />
                ))}
              </div>
            )}
          </section>

          {/* Dispatch History */}
          <section>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-2 mb-3 group"
            >
              <svg
                className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${showHistory ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider group-hover:text-[var(--text-primary)] transition-colors">
                Dispatch History
              </h2>
            </button>

            {showHistory && <DispatchHistory />}
          </section>
        </div>

        {/* Detail panel — right side on large screens */}
        {hasDetail && (
          <div className="hidden lg:flex w-80 shrink-0 flex-col border-l border-[var(--glass-border)]">
            <AgentRunDetail
              run={selectedRun}
              onClose={() => setSelectedRun(null)}
            />
          </div>
        )}
      </div>

      {/* Detail panel — overlay on narrow screens */}
      {hasDetail && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedRun(null)}
          />
          <div className="relative ml-auto w-80 max-w-full h-full bg-[var(--bg-primary)] flex flex-col shadow-2xl">
            <AgentRunDetail
              run={selectedRun}
              onClose={() => setSelectedRun(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
