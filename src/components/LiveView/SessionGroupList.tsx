import { useEffect, useState } from 'react'
import type { AgentCardProps } from './AgentCard'
import { getBadgeColor } from './agentColors'
import AgentWebSession from './AgentWebSession'

function elapsedSince(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function duration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function agentLabel(name: string, description?: string): string {
  if (name !== 'general-purpose') return name
  if (!description) return 'agent'
  return description.split(/\s+/).slice(0, 4).join(' ').slice(0, 24)
}

function flattenAgents(agents: AgentCardProps[]): AgentCardProps[] {
  const result: AgentCardProps[] = []
  for (const a of agents) {
    result.push(a)
    if (a.subAgents && a.subAgents.length > 0) {
      result.push(...flattenAgents(a.subAgents))
    }
  }
  return result.sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )
}

function statusIcon(status: string): string {
  if (status === 'DONE' || status === 'done') return '✓'
  if (status === 'BLOCKED' || status === 'blocked') return '✗'
  if (status === 'DONE_WITH_CONCERNS') return '⚠'
  if (status === 'stale') return '~'
  return '·'
}

function statusColor(status: string): string {
  if (status === 'DONE' || status === 'done') return 'text-green-500'
  if (status === 'BLOCKED' || status === 'blocked') return 'text-red-500'
  if (status === 'DONE_WITH_CONCERNS') return 'text-yellow-500'
  if (status === 'stale') return 'text-gray-500'
  return 'text-muted-foreground'
}

export interface SessionGroup {
  sessionId: string
  projectDir?: string
  projectName?: string
  startedAt: string
  lastModifiedMs: number
  isActive: boolean
  agents: AgentCardProps[]
}

interface Props {
  sessions: SessionGroup[]
}

export function SessionGroupList({ sessions }: Props) {
  const [, setTick] = useState(0)
  const [minimized, setMinimized] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'web'>(() =>
    (localStorage.getItem('cast-session-view-mode') as 'list' | 'web') ?? 'list'
  )
  const handleViewMode = (mode: 'list' | 'web') => {
    setViewMode(mode)
    localStorage.setItem('cast-session-view-mode', mode)
  }

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  function toggleMinimized(sessionId: string) {
    setMinimized(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  if (sessions.length === 0) return null

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* View mode toggle */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 rounded-lg border border-border overflow-hidden">
          {(['list', 'web'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => handleViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide transition-colors ${
                viewMode === mode
                  ? 'bg-accent text-accent-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Web view */}
      {viewMode === 'web' && sessions.map(session => (
        <AgentWebSession key={session.sessionId} session={session} />
      ))}

      {/* List view */}
      {viewMode === 'list' && sessions.map(session => {
        const allAgents = flattenAgents(session.agents)
        const running = allAgents.filter(a => a.status === 'running')
        const completed = allAgents.filter(a => a.status !== 'running')
        const isMinimized = minimized.has(session.sessionId)
        const projectName = session.projectName
          || session.projectDir?.split('/').filter(Boolean).at(-1)
          || session.sessionId.slice(0, 8)

        // Summary for minimized header
        const summary = [
          allAgents.length > 0 ? `${allAgents.length} agent${allAgents.length !== 1 ? 's' : ''}` : null,
          running.length > 0 ? `${running.length} running` : null,
          completed.length > 0 && running.length === 0 ? `${completed.length} completed` : null,
        ].filter(Boolean).join(' · ')

        return (
          <div key={session.sessionId} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Session header — clickable to collapse */}
            <button
              onClick={() => toggleMinimized(session.sessionId)}
              className="w-full flex items-center gap-2 px-4 py-2 border-b border-border hover:bg-muted/30 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${session.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-xs font-mono font-semibold text-foreground truncate">{projectName}</span>
              {isMinimized && summary && (
                <span className="text-xs font-mono text-muted-foreground ml-1 shrink-0">{summary}</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground font-mono shrink-0 flex items-center gap-2">
                {!isMinimized && <span>{elapsedSince(session.startedAt)}</span>}
                <span className="text-muted-foreground">{isMinimized ? '▸' : '▾'}</span>
              </span>
            </button>

            {/* Body — hidden when minimized */}
            {!isMinimized && (
              <>
                {/* Running agents */}
                {running.length > 0 && (
                  <div className="divide-y divide-border">
                    {running.map(agent => (
                      <div key={agent.agentId ?? agent.agentName} className="flex items-center gap-3 px-4 py-3">
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${getBadgeColor(agent.agentName)}`}>
                          {agentLabel(agent.agentName, agent.agentDescription)}
                        </span>
                        <span className="flex-1 text-sm text-foreground truncate font-mono">
                          {agent.currentActivity ?? agent.agentDescription ?? 'working\u2026'}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground font-mono whitespace-nowrap tabular-nums">
                          {elapsedSince(agent.startedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed agents (minimized history) */}
                {completed.length > 0 && (
                  <div className={`divide-y divide-border ${running.length > 0 ? 'border-t border-dashed border-border' : ''}`}>
                    {completed.map(agent => (
                      <div key={agent.agentId ?? agent.agentName} className="flex items-center gap-2 px-4 py-1.5 opacity-60">
                        <span className={`text-xs shrink-0 tabular-nums w-3 text-center ${statusColor(agent.status)}`}>
                          {statusIcon(agent.status)}
                        </span>
                        <span className={`shrink-0 px-1.5 py-0 rounded text-xs font-mono font-medium ${getBadgeColor(agent.agentName)}`}>
                          {agentLabel(agent.agentName, agent.agentDescription)}
                        </span>
                        <span className={`text-xs font-mono ${statusColor(agent.status)}`}>
                          {agent.status.toLowerCase()}
                        </span>
                        {agent.completedAt && (
                          <span className="ml-auto text-xs text-muted-foreground font-mono tabular-nums">
                            {duration(agent.startedAt, agent.completedAt)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {allAgents.length === 0 && (
                  <div className="px-4 py-3 text-xs text-muted-foreground font-mono">waiting for agents\u2026</div>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SessionGroupList
