import { useState, useEffect } from 'react'
import type { AgentRun } from '../../api/useAgentRuns'
import { getBadgeColor } from './agentColors'

interface WorktreeAgentRowProps {
  run: AgentRun
}

function agentLabel(agent: string, task_summary: string | null): string {
  if (agent !== 'general-purpose') return agent
  if (!task_summary) return 'agent'
  const words = task_summary.trim().split(/\s+/).slice(0, 4).join(' ')
  return words.length > 24 ? words.slice(0, 24) : words
}

export default function WorktreeAgentRow({ run }: WorktreeAgentRowProps) {
  // 1-second ticker for elapsed time
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = run.started_at
    ? Math.floor((Date.now() - new Date(run.started_at).getTime()) / 1000)
    : null
  const elapsedStr = elapsed !== null
    ? elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : null

  const projectChip = run.project ? run.project.split('/').at(-1) : null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Running pulse */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
      </span>

      {/* Agent name badge */}
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${getBadgeColor(run.agent)}`}>
        {agentLabel(run.agent, run.task_summary)}
      </span>

      {/* Worktree chip */}
      {projectChip && (
        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
          {projectChip}
        </span>
      )}

      {/* Task summary */}
      <span className="flex-1 text-xs text-muted-foreground truncate">
        {run.task_summary?.slice(0, 100) ?? 'working\u2026'}
      </span>

      {/* Right: model + elapsed */}
      <div className="shrink-0 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
        {run.model && <span>{run.model}</span>}
        {elapsedStr && <span>{elapsedStr}</span>}
      </div>
    </div>
  )
}
