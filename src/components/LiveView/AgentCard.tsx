import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AgentAvatar from './AgentAvatar'
import StatusPill, { type AgentStatus } from './StatusPill'
import WorkLogSection from './WorkLogSection'
import type { ParsedWorkLog } from '../../types/index'

export interface AgentCardProps {
  agentName: string
  model?: string
  status: AgentStatus
  workLog?: ParsedWorkLog
  startedAt: string
  completedAt?: string
  defaultExpanded?: boolean
  currentActivity?: string
}

function formatElapsed(start: string, end?: string): string {
  const a = new Date(start).getTime()
  const b = end ? new Date(end).getTime() : Date.now()
  const secs = Math.round((b - a) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return rem ? `${mins}m ${rem}s` : `${mins}m`
}

export default function AgentCard({
  agentName,
  model,
  status,
  workLog,
  startedAt,
  completedAt,
  defaultExpanded = false,
  currentActivity,
}: AgentCardProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const hasWorkLog = !!workLog && (
    workLog.items.length > 0 ||
    workLog.filesRead.length > 0 ||
    workLog.filesChanged.length > 0 ||
    !!workLog.codeReviewerResult ||
    !!workLog.testWriterResult ||
    workLog.decisions.length > 0
  )

  return (
    <div className="rounded-md border border-border/50 bg-card/60 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/10 transition-colors"
      >
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <AgentAvatar agentName={agentName} size="sm" />
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{agentName}</span>
        {model && (
          <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted/40">
            {model.includes('haiku') ? 'haiku' : model.includes('opus') ? 'opus' : 'sonnet'}
          </span>
        )}
        <StatusPill status={status} />
        <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
          {formatElapsed(startedAt, completedAt)}
        </span>
      </button>

      {/* Current activity line — always visible while running */}
      {status === 'running' && currentActivity && (
        <div className="px-3 pb-2 flex items-center gap-1.5">
          <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <span className="text-[10px] text-muted-foreground font-mono truncate">{currentActivity}</span>
        </div>
      )}

      {/* Collapsible Work Log */}
      <AnimatePresence initial={false}>
        {open && hasWorkLog && (
          <motion.div
            key="work-log"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1">
              <WorkLogSection workLog={workLog!} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
