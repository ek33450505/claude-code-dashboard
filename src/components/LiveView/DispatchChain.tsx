import React, { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import AgentCard, { type AgentCardProps } from './AgentCard'
import { timeAgo } from '../../utils/time'

export interface DispatchChainProps {
  promptPreview: string
  agents: AgentCardProps[]
  startedAt: string
  isActive: boolean
  defaultExpanded?: boolean
}

export default function DispatchChain({
  promptPreview,
  agents,
  startedAt,
  isActive,
  defaultExpanded = false,
}: DispatchChainProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const preview = promptPreview.slice(0, 120)

  // Separate top-level orchestrators from sub-agents
  const topLevel = agents.filter(a => !a.isSubagent)
  const subAgents = agents.filter(a => a.isSubagent)

  // Attach sub-agents to the first running top-level agent, or the most recent one
  const orchestratorIdx = topLevel.findIndex(a => a.status === 'running')
  const attachIdx = orchestratorIdx >= 0 ? orchestratorIdx : 0

  const enrichedTopLevel: AgentCardProps[] = topLevel.map((agent, i) => ({
    ...agent,
    subAgents: i === attachIdx ? subAgents : [],
  }))

  return (
    <div
      className={`rounded-lg border bg-card/50 overflow-hidden transition-colors ${
        isActive ? 'border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]' : 'border-border/50'
      }`}
    >
      {/* Chain header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-2 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors"
      >
        <span className="text-muted-foreground flex-shrink-0 mt-0.5">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <MessageSquare size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <span className={`text-xs text-foreground font-medium flex-1 italic ${open ? 'break-words' : 'truncate'}`}>
          "{open ? promptPreview : preview}{!open && promptPreview.length > 120 ? '…' : ''}"
        </span>
        {isActive && (
          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        )}
        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
          {timeAgo(startedAt)}
        </span>
      </button>

      {/* Agent cards — top-level agents, each carrying their sub-agents */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {enrichedTopLevel.length > 0
            ? enrichedTopLevel.map((agent, i) => (
                <AgentCard key={`${agent.agentName}-${i}`} {...agent} />
              ))
            : subAgents.map((agent, i) => (
                // Fallback: no top-level agents yet, show sub-agents directly
                <div key={`${agent.agentName}-sub-${i}`} className="pl-6">
                  <AgentCard {...agent} />
                </div>
              ))
          }
        </div>
      )}
    </div>
  )
}
