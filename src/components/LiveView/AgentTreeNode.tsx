import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type AgentStageData, type AgentStatus } from './AgentStage'
import StatusPill, { type AgentStatus as PillStatus } from './StatusPill'

// Copied from AgentStage.tsx — avoid cross-component import for leaf utilities
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
  const lower = model.toLowerCase()
  let label = model
  let cls = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
  if (lower.includes('haiku')) {
    label = 'Haiku'
    cls = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
  } else if (lower.includes('opus')) {
    label = 'Opus'
    cls = 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  } else if (lower.includes('sonnet')) {
    label = 'Sonnet'
    cls = 'bg-purple-500/10 text-purple-400 border-purple-500/20'
  }
  return (
    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

// StatusPill doesn't accept 'pending' — map it to nearest visual equivalent
function toPillStatus(status: AgentStatus): PillStatus {
  if (status === 'pending') return 'running'
  return status as PillStatus
}

function dotClass(status: AgentStatus): string {
  switch (status) {
    case 'running':
      return 'bg-[var(--accent)] animate-pulse ring-2 ring-[var(--accent)]/30'
    case 'DONE':
    case 'DONE_WITH_CONCERNS':
      return 'bg-green-400'
    case 'BLOCKED':
      return 'bg-red-400'
    case 'stale':
      return 'bg-amber-400'
    case 'pending':
    default:
      return 'bg-[var(--text-muted)]'
  }
}

interface AgentTreeNodeProps extends AgentStageData {
  depth: number
}

export default function AgentTreeNode({
  agentName,
  status,
  model,
  startedAt,
  completedAt,
  currentActivity,
  children,
  depth,
}: AgentTreeNodeProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [status])

  const isRunning = status === 'running'
  const isDone = status === 'DONE' || status === 'DONE_WITH_CONCERNS' || status === 'stale' || status === 'BLOCKED'
  const timeLabel = completedAt
    ? durationLabel(startedAt, completedAt)
    : isRunning
    ? elapsedLabel(startedAt, now)
    : null

  const nameTextCls = depth === 0
    ? 'text-sm font-semibold text-[var(--text-primary)]'
    : 'text-xs font-medium text-[var(--text-primary)]'

  const nodeOpacity = depth >= 1 && isDone ? 'opacity-60' : ''

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.15 }}
        className={nodeOpacity}
      >
        {/* Node row */}
        <div className="flex items-start gap-2">
          {/* Connector area */}
          <div className="w-4 flex-shrink-0 flex items-center justify-center pt-1.5">
            {depth === 0 ? null : (
              <div
                className="w-3 h-4 border-l border-b border-[var(--border)] rounded-bl"
                style={{ marginTop: '-8px' }}
              />
            )}
          </div>

          {/* Status dot */}
          <div className="flex-shrink-0 pt-1.5">
            <span className={`block w-1.5 h-1.5 rounded-full ${dotClass(status)}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`truncate ${nameTextCls}`}>{agentName}</span>
              <StatusPill status={toPillStatus(status)} />
              {modelBadge(model)}
              {timeLabel && (
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {timeLabel}
                </span>
              )}
              {/* Inline activity for children (compact) */}
              {depth >= 1 && isRunning && currentActivity && (
                <span className="font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[300px]">
                  {currentActivity}
                </span>
              )}
            </div>

            {/* Activity line — root nodes only */}
            {depth === 0 && isRunning && currentActivity && (
              <div className="font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[400px] mt-0.5">
                {currentActivity}
              </div>
            )}

            {/* Children — indent capped at depth 2 to avoid runaway nesting */}
            {children && children.length > 0 && depth < 3 && (
              <div className="ml-3 mt-1.5 pl-3 border-l border-[var(--border)] space-y-1.5">
                {children.map((child, idx) => (
                  <AgentTreeNode
                    key={`${child.agentName}-${child.startedAt}`}
                    {...child}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
