import WorktreeAgentRow from './WorktreeAgentRow'
import type { AgentRun } from '../../api/useAgentRuns'

interface WorktreeAgentsSectionProps {
  runs: AgentRun[]
}

export default function WorktreeAgentsSection({ runs }: WorktreeAgentsSectionProps) {
  if (runs.length === 0) return null

  return (
    <div className="border border-border rounded-xl overflow-hidden mb-3">
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
        </span>
        <span className="text-xs font-semibold text-foreground">Worktree Agents</span>
        <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary">
          {runs.length}
        </span>
      </div>
      {runs.map(run => (
        <WorktreeAgentRow key={run.id} run={run} />
      ))}
    </div>
  )
}
