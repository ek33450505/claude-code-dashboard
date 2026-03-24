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

  return (
    <div
      className={`rounded-lg border bg-card/50 overflow-hidden transition-colors ${
        isActive ? 'border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]' : 'border-border/50'
      }`}
    >
      {/* Chain header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/10 transition-colors"
      >
        {/* Active indicator left border via inline style */}
        <span className="text-muted-foreground flex-shrink-0">
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
        <MessageSquare size={13} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-foreground font-medium flex-1 truncate italic">
          "{preview}{promptPreview.length > 120 ? '…' : ''}"
        </span>
        {isActive && (
          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        )}
        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
          {timeAgo(startedAt)}
        </span>
      </button>

      {/* Agent cards */}
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-2">
          {agents.map((agent, i) => (
            <AgentCard key={`${agent.agentName}-${i}`} {...agent} />
          ))}
        </div>
      )}
    </div>
  )
}
