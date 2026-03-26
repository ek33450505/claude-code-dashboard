import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Wrench, FileText, Terminal, Search, ArrowRight, CheckSquare } from 'lucide-react'
import AgentAvatar from './AgentAvatar'
import StatusPill, { type AgentStatus } from './StatusPill'
import WorkLogSection from './WorkLogSection'
import type { ParsedWorkLog } from '../../types/index'
import { getAgentCategory, CATEGORY_COLORS } from '../../utils/agentCategories'

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  return `${Math.round(diff / 60_000)}m ago`
}

function getModelTierStyle(model?: string): { label: string; className: string } | null {
  if (!model) return null
  if (model.includes('haiku')) return { label: 'Haiku', className: 'bg-cyan-500/15 text-cyan-400' }
  if (model.includes('opus')) return { label: 'Opus', className: 'bg-amber-500/15 text-amber-400' }
  if (model.includes('sonnet')) return { label: 'Sonnet', className: 'bg-purple-500/15 text-purple-400' }
  return null
}

export interface ToolEvent {
  id: string
  toolName: string
  inputPreview: string
  timestamp: string
}

export interface AgentCardProps {
  agentName: string
  agentId?: string           // file UUID from the JSONL path — used for sub-agent tool attribution
  model?: string
  status: AgentStatus
  workLog?: ParsedWorkLog
  startedAt: string
  completedAt?: string
  defaultExpanded?: boolean
  currentActivity?: string
  lastSeenMs?: number
  // Feature 1: sub-agent hierarchy
  isSubagent?: boolean       // marks this card as a sub-agent (for layout in DispatchChain)
  subAgents?: AgentCardProps[]
  // Feature 2: expanded card body
  agentDescription?: string
  toolEvents?: ToolEvent[]
}

function ActivityDisplay({ activity }: { activity: string }) {
  const colonIdx = activity.indexOf(': ')
  const tool = colonIdx >= 0 ? activity.slice(0, colonIdx) : activity
  const detail = colonIdx >= 0 ? activity.slice(colonIdx + 2) : ''
  const icons: Record<string, React.ReactNode> = {
    Read:      <FileText size={9} className="flex-shrink-0 opacity-60" />,
    Write:     <FileText size={9} className="flex-shrink-0 opacity-60" />,
    Edit:      <FileText size={9} className="flex-shrink-0 opacity-60" />,
    Bash:      <Terminal size={9} className="flex-shrink-0 opacity-60" />,
    Grep:      <Search size={9} className="flex-shrink-0 opacity-60" />,
    Glob:      <Search size={9} className="flex-shrink-0 opacity-60" />,
    Dispatch:  <ArrowRight size={9} className="flex-shrink-0 text-blue-400/70" />,
    TodoWrite: <CheckSquare size={9} className="flex-shrink-0 opacity-60" />,
  }
  const icon = icons[tool] ?? <span className="h-1 w-1 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
  return (
    <div className="px-3 pb-2 flex items-center gap-1.5">
      {icon}
      <span className="text-[10px] text-muted-foreground font-mono truncate">
        <span className="text-foreground/50">{tool}:</span> {detail}
      </span>
    </div>
  )
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
  lastSeenMs,
  subAgents = [],
  agentDescription,
  toolEvents = [],
}: AgentCardProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const category = getAgentCategory(agentName)
  const categoryColors = category ? CATEGORY_COLORS[category] : null
  const modelTier = getModelTierStyle(model)
  const hasWorkLog = !!workLog && (
    workLog.items.length > 0 ||
    workLog.filesRead.length > 0 ||
    workLog.filesChanged.length > 0 ||
    !!workLog.codeReviewerResult ||
    !!workLog.testWriterResult ||
    workLog.decisions.length > 0
  )
  const hasExpandedContent = hasWorkLog || !!agentDescription || toolEvents.length > 0

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
        {/* Sub-agent count badge when collapsed */}
        {!open && subAgents.length > 0 && (
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-mono">
            {subAgents.length} sub-agent{subAgents.length !== 1 ? 's' : ''}
          </span>
        )}
        {/* Category badge */}
        {categoryColors && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${categoryColors.bg} ${categoryColors.text}`}>
            {category}
          </span>
        )}
        {/* Model tier pill */}
        {modelTier && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${modelTier.className}`}>
            {modelTier.label}
          </span>
        )}
        <StatusPill status={status} />
        <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
          {formatElapsed(startedAt, completedAt)}
        </span>
        {/* Last seen relative timestamp */}
        {lastSeenMs && status === 'running' && (
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">
            {formatRelativeTime(lastSeenMs)}
          </span>
        )}
      </button>

      {/* Current activity line — always visible while running */}
      {status === 'running' && (currentActivity || agentDescription) && (
        currentActivity
          ? <ActivityDisplay activity={currentActivity} />
          : (
            <div className="px-3 pb-2 flex items-center gap-1.5">
              <ArrowRight size={9} className="flex-shrink-0 text-blue-400/50" />
              <span className="text-[10px] text-muted-foreground/70 italic truncate">{agentDescription}</span>
            </div>
          )
      )}

      {/* Collapsible body: task description + work log + tool feed */}
      <AnimatePresence initial={false}>
        {open && hasExpandedContent && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 flex flex-col gap-1.5">
              {/* Task description */}
              {agentDescription && (
                <p className="text-[11px] text-muted-foreground italic leading-snug border-l-2 border-border/60 pl-2">
                  {agentDescription}
                </p>
              )}

              {/* Work log */}
              {hasWorkLog && <WorkLogSection workLog={workLog!} />}

              {/* Tool call feed */}
              {toolEvents.length > 0 && (
                <div className="mt-1 flex flex-col gap-0">
                  <div className="flex items-center gap-1 mb-1">
                    <Wrench size={9} className="text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      Tool feed · {toolEvents.length} call{toolEvents.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-px pr-1">
                    {toolEvents.map(ev => {
                      const toolIcons: Record<string, React.ReactNode> = {
                        Read:      <FileText size={9} className="flex-shrink-0 text-sky-400/70" />,
                        Write:     <FileText size={9} className="flex-shrink-0 text-emerald-400/70" />,
                        Edit:      <FileText size={9} className="flex-shrink-0 text-amber-400/70" />,
                        Bash:      <Terminal size={9} className="flex-shrink-0 text-orange-400/70" />,
                        Grep:      <Search size={9} className="flex-shrink-0 text-purple-400/70" />,
                        Glob:      <Search size={9} className="flex-shrink-0 text-purple-400/70" />,
                        Agent:     <ArrowRight size={9} className="flex-shrink-0 text-blue-400/70" />,
                        TodoWrite: <CheckSquare size={9} className="flex-shrink-0 text-teal-400/70" />,
                      }
                      const icon = toolIcons[ev.toolName] ?? <Wrench size={9} className="flex-shrink-0 opacity-40" />
                      const ts = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
                      return (
                        <div key={ev.id} className="flex items-start gap-1.5 text-[10px] text-muted-foreground font-mono leading-snug py-0.5 border-b border-border/10 last:border-0">
                          <span className="mt-0.5 flex-shrink-0">{icon}</span>
                          <span className="flex-1 min-w-0">
                            <span className="text-foreground/60 font-semibold">{ev.toolName}</span>
                            {ev.inputPreview && (
                              <span className="text-muted-foreground/80 break-all ml-1">{ev.inputPreview}</span>
                            )}
                          </span>
                          {ts && <span className="flex-shrink-0 text-muted-foreground/30 tabular-nums">{ts}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-agents — indented below this card when expanded */}
      {open && subAgents.length > 0 && (
        <div className="pl-6 pr-3 pb-3 flex flex-col gap-2 border-t border-border/30 pt-2">
          {subAgents.map((sub, i) => (
            <AgentCard key={`${sub.agentName}-sub-${i}`} {...sub} />
          ))}
        </div>
      )}
    </div>
  )
}
