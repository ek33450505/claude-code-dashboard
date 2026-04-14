import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { modelBadgeClasses, modelLabel } from '../../utils/modelBadge'

export type AgentStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'BLOCKED' | 'NEEDS_CONTEXT' | 'running' | 'stale' | 'pending'

export interface AgentStageData {
  agentName: string
  status: AgentStatus
  model?: string
  startedAt: string
  completedAt?: string
  currentActivity?: string
  children?: AgentStageData[]
}

interface AgentStageProps extends AgentStageData {
  className?: string
}

function elapsedLabel(startedAt: string, now: number): string {
  const startMs = new Date(startedAt).getTime()
  const diff = Math.max(0, Math.floor((now - startMs) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function durationLabel(startedAt: string, completedAt: string): string {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diff = Math.max(0, Math.floor((end - start) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function modelBadge(model?: string) {
  if (!model) return null
  return (
    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold border ${modelBadgeClasses(model)}`}>
      {modelLabel(model)}
    </span>
  )
}

export default function AgentStage({
  agentName,
  status,
  model,
  startedAt,
  completedAt,
  currentActivity,
  className = '',
}: AgentStageProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status])

  const isActive = status === 'running'

  if (isActive) {
    return (
      <motion.div
        layout
        className={`flex-shrink-0 rounded-xl border border-[var(--accent)] bg-[var(--bg-secondary)] p-3 flex flex-col gap-1.5 relative ${className}`}
        style={{
          width: 200,
          minHeight: 80,
          boxShadow: '0 0 12px rgba(0,255,194,0.2)',
        }}
      >
        {/* Pulsing mint dot */}
        <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />

        {/* Agent name + model */}
        <div className="flex items-center gap-1.5 pr-5">
          <span className="text-[var(--text-primary)] font-semibold text-xs leading-tight truncate">
            {agentName}
          </span>
          {modelBadge(model)}
        </div>

        {/* Elapsed timer */}
        <span className="text-[var(--accent)] font-mono text-[10px]">
          {elapsedLabel(startedAt, now)}
        </span>

        {/* Current activity */}
        {currentActivity && (
          <span className="font-mono text-[10px] text-[var(--text-muted)] truncate leading-tight">
            {currentActivity}
          </span>
        )}
      </motion.div>
    )
  }

  // Compact pill mode
  let pillCls = ''
  let icon = ''
  let label = agentName
  let duration = ''

  if (completedAt) {
    duration = durationLabel(startedAt, completedAt)
  }

  switch (status) {
    case 'DONE':
    case 'DONE_WITH_CONCERNS':
      pillCls = 'bg-green-500/10 border-green-500/30 text-green-400'
      icon = '✓'
      break
    case 'BLOCKED':
      pillCls = 'bg-red-500/10 border-red-500/30 text-red-400'
      icon = '✗'
      break
    case 'stale':
      pillCls = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      icon = '✓'
      break
    case 'pending':
    default:
      pillCls = 'bg-[var(--bg-secondary)] border-dashed border-[var(--border)] text-[var(--text-muted)]'
      icon = ''
      break
  }

  return (
    <motion.div
      layout
      className={`flex-shrink-0 h-8 rounded-full border px-2.5 flex items-center gap-1 text-xs font-medium ${pillCls} ${className}`}
      style={{ minWidth: 100, maxWidth: 160 }}
    >
      {icon && <span>{icon}</span>}
      <span className="truncate">{label}</span>
      {duration && (
        <span className="opacity-60 font-mono text-[10px] ml-0.5">{duration}</span>
      )}
    </motion.div>
  )
}
