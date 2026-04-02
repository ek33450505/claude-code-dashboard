import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getBadgeColor } from './agentColors'
import WorkLogSection from './WorkLogSection'
import type { AgentCardProps } from './AgentCard'

// Status ring styles
const STATUS_RING: Record<string, string> = {
  running: 'ring-2 ring-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]',
  DONE: 'ring-1 ring-green-500/60',
  DONE_WITH_CONCERNS: 'ring-2 ring-yellow-400/80',
  BLOCKED: 'ring-2 ring-red-400/80 shadow-[0_0_8px_rgba(248,113,113,0.3)]',
  NEEDS_CONTEXT: 'ring-1 ring-orange-400/70',
  stale: 'ring-1 ring-zinc-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  running: 'running',
  DONE: 'done',
  DONE_WITH_CONCERNS: 'concerns',
  BLOCKED: 'blocked',
  NEEDS_CONTEXT: 'needs context',
  stale: 'stale',
}

const STATUS_LABEL_COLOR: Record<string, string> = {
  running: 'text-blue-400',
  DONE: 'text-green-400',
  DONE_WITH_CONCERNS: 'text-yellow-400',
  BLOCKED: 'text-red-400',
  NEEDS_CONTEXT: 'text-orange-400',
  stale: 'text-zinc-500',
}

interface AgentWebNodeProps {
  agent: AgentCardProps
  nodeId: string
}

function agentLabel(agentName: string, agentDescription: string | undefined): string {
  if (agentName !== 'general-purpose') return agentName
  if (!agentDescription) return 'agent'
  const words = agentDescription.trim().split(/\s+/).slice(0, 4).join(' ')
  return words.length > 24 ? words.slice(0, 24) : words
}

export default function AgentWebNode({ agent, nodeId }: AgentWebNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const status = agent.status ?? 'running'
  const isDone = status === 'DONE' || status === 'DONE_WITH_CONCERNS' || status === 'stale'
  const ringClass = STATUS_RING[status] ?? STATUS_RING.stale

  return (
    <motion.div
      data-nodeid={nodeId}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDone ? 0.6 : 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-xl bg-card border border-border cursor-pointer select-none transition-opacity ${ringClass}`}
      style={{ minWidth: 160, maxWidth: 240 }}
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(e => !e)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(prev => !prev) } }}
      title={agent.currentActivity ?? agent.agentDescription ?? ''}
    >
      <div className="px-3 py-2.5 flex flex-col gap-1">
        {/* Header: badge + status */}
        <div className="flex items-center justify-between gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${getBadgeColor(agent.agentName)}`}>
            {agentLabel(agent.agentName, agent.agentDescription)}
          </span>
          <span className={`text-[10px] font-mono shrink-0 ${STATUS_LABEL_COLOR[status] ?? 'text-zinc-500'}`}>
            {STATUS_LABEL[status] ?? status}
          </span>
        </div>

        {/* Activity */}
        {agent.currentActivity && (
          <p className="text-[11px] text-muted-foreground truncate leading-tight">
            {agent.currentActivity}
          </p>
        )}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-2 flex flex-col gap-2 max-h-48 overflow-y-auto">
              {agent.agentDescription && (
                <p className="text-[11px] italic text-muted-foreground">{agent.agentDescription}</p>
              )}
              {agent.workLog && <WorkLogSection workLog={agent.workLog} />}
              {agent.toolEvents && agent.toolEvents.length > 0 && (
                <div className="flex flex-col gap-1">
                  {agent.toolEvents.slice(-5).map((te, i) => (
                    <div key={i} className="text-[10px] font-mono text-muted-foreground truncate">
                      {te.toolName}: {te.inputPreview}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
