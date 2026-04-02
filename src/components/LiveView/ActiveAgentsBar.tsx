import { useEffect, useState } from 'react'
import type { AgentCardProps } from './AgentCard'
import { getBadgeColor } from './agentColors'

interface Props {
  agents: AgentCardProps[]
}

function elapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function ActiveAgentsBar({ agents }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  if (agents.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card mb-4">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
        <span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground uppercase">
          Active Agents
        </span>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{agents.length} running</span>
      </div>
      <div className="divide-y divide-border">
        {agents.map(agent => (
          <div key={agent.agentId ?? agent.agentName} className="flex items-center gap-3 px-4 py-3">
            <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${getBadgeColor(agent.agentName)}`}>
              {agent.agentName}
            </span>
            <span className="flex-1 text-sm text-foreground truncate font-mono">
              {agent.currentActivity ?? agent.agentDescription ?? 'working…'}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground font-mono whitespace-nowrap tabular-nums">
              {elapsed(agent.startedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ActiveAgentsBar
