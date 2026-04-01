import { useEffect, useState } from 'react'
import type { AgentStageData } from './AgentStage'
import AgentTreeNode from './AgentTreeNode'

export interface ChainPipelineProps {
  chainId: string
  sessionId: string
  projectName: string
  agents: AgentStageData[]
  startedAt: string
  isActive: boolean
}

function elapsedLabel(startedAt: string, now: number): string {
  const diff = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function ChainPipeline({
  chainId: _chainId,
  sessionId,
  projectName,
  agents,
  startedAt,
  isActive,
}: ChainPipelineProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive])

  const displayAgents: AgentStageData[] = agents.length > 0
    ? agents
    : [{ agentName: 'starting…', status: 'running', startedAt }]

  return (
    <div
      className={`rounded-xl border bg-[var(--bg-secondary)] p-4 transition-all ${
        isActive
          ? 'border-[var(--glass-border)] shadow-[0_0_16px_rgba(0,255,194,0.08)]'
          : 'border-[var(--border)] opacity-75'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
            {projectName}
          </span>
          <span className="text-[var(--text-muted)] text-xs">·</span>
          <span className="font-mono text-xs text-[var(--text-muted)] flex-shrink-0">
            {sessionId.slice(0, 8)}
          </span>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)] flex-shrink-0 ml-2">
          {elapsedLabel(startedAt, now)}
        </span>
      </div>

      {/* Tree body */}
      <div className="space-y-2">
        {displayAgents.map((agent, idx) => (
          <AgentTreeNode
            key={`${agent.agentName}-${agent.startedAt}-${idx}`}
            {...agent}
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}
