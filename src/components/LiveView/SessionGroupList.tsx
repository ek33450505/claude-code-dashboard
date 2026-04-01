import { useEffect, useState } from 'react'
import type { AgentCardProps } from './AgentCard'

// Re-use the same badge colors as ActiveAgentsBar
const BADGE_COLORS: Record<string, string> = {
  'code-writer': 'bg-green-700 text-green-100',
  'code-reviewer': 'bg-slate-600 text-slate-100',
  'orchestrator': 'bg-teal-700 text-teal-100',
  'commit': 'bg-gray-600 text-gray-100',
  'push': 'bg-gray-500 text-gray-100',
  'debugger': 'bg-orange-700 text-orange-100',
  'planner': 'bg-blue-700 text-blue-100',
  'researcher': 'bg-purple-700 text-purple-100',
  'test-runner': 'bg-yellow-700 text-yellow-100',
  'test-writer': 'bg-yellow-700 text-yellow-100',
  'bash-specialist': 'bg-amber-700 text-amber-100',
  'devops': 'bg-cyan-700 text-cyan-100',
  'docs': 'bg-sky-700 text-sky-100',
  'frontend-qa': 'bg-pink-700 text-pink-100',
  'merge': 'bg-violet-700 text-violet-100',
  'security': 'bg-red-700 text-red-100',
  'morning-briefing': 'bg-indigo-700 text-indigo-100',
}

function getBadgeColor(name: string): string {
  return BADGE_COLORS[name.toLowerCase()] ?? 'bg-indigo-700 text-indigo-100'
}

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
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (sessions.length === 0) return null

  return (
    <div className="flex flex-col gap-3 mb-4">
      {sessions.map(session => {
        const allAgents = flattenAgents(session.agents)
        const running = allAgents.filter(a => a.status === 'running')
        const completed = allAgents.filter(a => a.status !== 'running')
        const projectName = session.projectDir
          ? session.projectDir.split('/').filter(Boolean).at(-1) ?? session.sessionId.slice(0, 8)
          : session.sessionId.slice(0, 8)

        return (
          <div key={session.sessionId} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Session header */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  session.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                }`}
              />
              <span className="text-xs font-mono font-semibold text-foreground truncate">
                {projectName}
              </span>
              <span className="text-xs font-mono text-muted-foreground ml-auto shrink-0">
                {elapsedSince(session.startedAt)}
              </span>
            </div>

            {/* Running agents — full row height */}
            {running.length > 0 && (
              <div className="divide-y divide-border">
                {running.map(agent => (
                  <div
                    key={agent.agentId ?? agent.agentName}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${getBadgeColor(agent.agentName)}`}
                    >
                      {agent.agentName}
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

            {/* Completed agents — compact history rows */}
            {completed.length > 0 && (
              <div
                className={`divide-y divide-border ${
                  running.length > 0 ? 'border-t border-dashed border-border' : ''
                }`}
              >
                {completed.map(agent => (
                  <div
                    key={agent.agentId ?? agent.agentName}
                    className="flex items-center gap-2 px-4 py-1.5 opacity-60"
                  >
                    <span
                      className={`text-xs shrink-0 tabular-nums w-3 text-center ${statusColor(agent.status)}`}
                    >
                      {statusIcon(agent.status)}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-0 rounded text-xs font-mono font-medium ${getBadgeColor(agent.agentName)}`}
                    >
                      {agent.agentName}
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

            {/* Empty state: no agents yet */}
            {allAgents.length === 0 && (
              <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
                waiting for agents\u2026
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default SessionGroupList
