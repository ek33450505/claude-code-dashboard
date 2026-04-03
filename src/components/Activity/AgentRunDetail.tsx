import { X } from 'lucide-react'
import type { AgentRun } from '../../api/useAgentRuns'
import { formatCost, formatTokens } from '../../utils/costEstimate'
import { formatDuration } from '../../utils/time'
import StatusPill from './StatusPill'
import ModelBadge from './ModelBadge'

interface AgentRunDetailProps {
  run: AgentRun | null
  onClose: () => void
}

function computeDuration(run: AgentRun): number | null {
  if (!run.started_at) return null
  const end = run.ended_at ? new Date(run.ended_at).getTime() : Date.now()
  return end - new Date(run.started_at).getTime()
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface StatItemProps {
  label: string
  value: string
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
        {value}
      </span>
    </div>
  )
}

export default function AgentRunDetail({ run, onClose }: AgentRunDetailProps) {
  if (!run) return null

  const duration = computeDuration(run)

  return (
    <div
      className="flex flex-col h-full border-l border-[var(--glass-border)] bg-[var(--bg-secondary)]"
    >
      {/* Header */}
      <div className="flex items-start gap-2 px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-[var(--text-primary)] truncate">
              {run.agent}
            </span>
            {run.model && <ModelBadge model={run.model} />}
            <StatusPill status={run.status} />
          </div>
          {run.session_id && (
            <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5 truncate">
              {run.session_id}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors flex-shrink-0"
          aria-label="Close detail panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3 border-b border-[var(--glass-border)]">
        <StatItem label="Cost" value={run.cost_usd != null ? formatCost(run.cost_usd) : '—'} />
        <StatItem label="Duration" value={formatDuration(duration)} />
        <StatItem label="Input Tokens" value={run.input_tokens != null ? formatTokens(run.input_tokens) : '—'} />
        <StatItem label="Output Tokens" value={run.output_tokens != null ? formatTokens(run.output_tokens) : '—'} />
        <StatItem label="Started" value={formatDateTime(run.started_at)} />
        <StatItem label="Ended" value={formatDateTime(run.ended_at)} />
      </div>

      {/* Task summary */}
      {run.task_summary && (
        <div className="px-4 py-3 flex-1 overflow-y-auto">
          <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
            Task Summary
          </p>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
            {run.task_summary}
          </p>
        </div>
      )}
    </div>
  )
}
