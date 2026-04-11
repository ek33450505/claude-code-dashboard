import type { TeammateRun } from '../../types'

interface TeammateRowProps {
  teammate: TeammateRun
}

function statusPillClass(status: string): string {
  switch (status) {
    case 'working':  return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    case 'done':     return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    case 'failed':   return 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
    case 'idle':
    default:         return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
  }
}

function agentDefBadge(agentDef: string | null) {
  if (!agentDef) return null
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20">
      {agentDef}
    </span>
  )
}

export function TeammateRow({ teammate }: TeammateRowProps) {
  const totalTokens = teammate.tokens_in + teammate.tokens_out
  const subject = teammate.task_subject
    ? teammate.task_subject.length > 60
      ? teammate.task_subject.slice(0, 60) + '…'
      : teammate.task_subject
    : null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
      {/* Role */}
      <span className="w-32 shrink-0 text-sm font-medium text-[var(--text-primary)] truncate">
        {teammate.agent_role}
      </span>

      {/* Agent def badge */}
      <div className="w-28 shrink-0">
        {agentDefBadge(teammate.agent_def)}
      </div>

      {/* Status pill */}
      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusPillClass(teammate.status)}`}>
        {teammate.status}
      </span>

      {/* Task subject */}
      <span className="flex-1 text-xs text-[var(--text-secondary)] truncate min-w-0">
        {subject ?? <span className="text-[var(--text-muted)] italic">No task</span>}
      </span>

      {/* Token spend */}
      <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums w-20 text-right">
        {totalTokens > 0 ? totalTokens.toLocaleString() + ' tok' : '—'}
      </span>
    </div>
  )
}
