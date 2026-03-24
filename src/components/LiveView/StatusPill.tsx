import React from 'react'

export type AgentStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'BLOCKED' | 'NEEDS_CONTEXT' | 'running'

interface StatusPillProps {
  status: AgentStatus
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; classes: string }> = {
  DONE: {
    label: 'DONE',
    classes: 'bg-green-500/15 text-green-400 border border-green-500/30',
  },
  DONE_WITH_CONCERNS: {
    label: 'CONCERNS',
    classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  },
  BLOCKED: {
    label: 'BLOCKED',
    classes: 'bg-red-500/15 text-red-400 border border-red-500/30',
  },
  NEEDS_CONTEXT: {
    label: 'NEEDS CTX',
    classes: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  },
  running: {
    label: 'RUNNING',
    classes: 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse',
  },
}

export default function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['running']
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide ${config.classes}`}>
      {config.label}
    </span>
  )
}
