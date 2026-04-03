import { motion } from 'framer-motion'
import type { AgentRun } from '../../api/useAgentRuns'
import { formatCost } from '../../utils/costEstimate'
import { formatDuration, timeAgo } from '../../utils/time'
import StatusPill from './StatusPill'
import ModelBadge from './ModelBadge'

interface AgentRunCardProps {
  run: AgentRun
  onClick?: () => void
  selected?: boolean
}

const STATUS_DOT: Record<string, string> = {
  running: 'bg-blue-400 animate-pulse',
  DONE: 'bg-green-400',
  DONE_WITH_CONCERNS: 'bg-yellow-400',
  BLOCKED: 'bg-red-400',
  NEEDS_CONTEXT: 'bg-orange-400',
}

function dotClass(status: string): string {
  return STATUS_DOT[status] ?? 'bg-zinc-500'
}

function computeDuration(run: AgentRun): number | null {
  if (!run.started_at) return null
  const end = run.ended_at ? new Date(run.ended_at).getTime() : Date.now()
  const start = new Date(run.started_at).getTime()
  return end - start
}

export default function AgentRunCard({ run, onClick, selected }: AgentRunCardProps) {
  if (run.agent === 'unknown') return null

  const summary = run.task_summary
    ? run.task_summary.length > 80
      ? run.task_summary.slice(0, 80) + '…'
      : run.task_summary
    : null

  const duration = computeDuration(run)
  const relTime = run.started_at ? timeAgo(run.started_at) : '--'

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.12 }}
      className={`cursor-pointer rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 transition-colors ${
        selected
          ? 'border-[var(--accent)] bg-[var(--bg-secondary)]'
          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40'
      }`}
    >
      {/* Top row */}
      <div className="flex items-center gap-2">
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass(run.status)}`} />

        {/* Agent name */}
        <span className="text-sm font-semibold text-[var(--text-primary)] flex-1 truncate">
          {run.agent}
        </span>

        {/* Model badge */}
        {run.model && <ModelBadge model={run.model} />}

        {/* Cost */}
        <span className="text-xs text-[var(--text-secondary)] tabular-nums">
          {run.cost_usd != null ? formatCost(run.cost_usd) : '—'}
        </span>

        {/* Duration */}
        <span className="text-xs text-[var(--text-secondary)] tabular-nums">
          {formatDuration(duration)}
        </span>

        {/* Relative time */}
        <span className="text-[10px] text-[var(--text-secondary)] tabular-nums">
          {relTime}
        </span>
      </div>

      {/* Status pill row */}
      <div className="flex items-center gap-1.5">
        <StatusPill status={run.status} />
      </div>

      {/* Task summary */}
      {summary && (
        <p className="text-[11px] text-[var(--text-secondary)] leading-snug truncate">
          {summary}
        </p>
      )}
    </motion.div>
  )
}
