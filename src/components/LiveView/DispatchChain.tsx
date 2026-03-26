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
  projectDir?: string
}

export default function DispatchChain({
  promptPreview,
  agents,
  startedAt,
  isActive,
  defaultExpanded = false,
  projectDir,
}: DispatchChainProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const preview = promptPreview.slice(0, 120)

  // Extract project name from projectDir (last path segment)
  const projectName = projectDir?.split('/').pop() ?? null

  // Sort agents by startedAt ascending to show dispatch order
  const sortedAgents = [...agents].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )

  // Separate top-level orchestrators from sub-agents
  const topLevel = sortedAgents.filter(a => !a.isSubagent)
  const subAgents = sortedAgents.filter(a => a.isSubagent)

  // Attach sub-agents to the most recently started running agent (not the first)
  const runningTopLevel = topLevel.filter(a => a.status === 'running')
  const attachTarget = runningTopLevel.length > 0
    ? runningTopLevel[runningTopLevel.length - 1]   // most recently started running agent
    : topLevel[topLevel.length - 1]                  // fallback: last top-level agent
  const attachIdx = attachTarget ? topLevel.indexOf(attachTarget) : 0

  const enrichedTopLevel: AgentCardProps[] = topLevel.map((agent, i) => ({
    ...agent,
    subAgents: i === attachIdx ? subAgents : [],
  }))

  function stepDotClass(status: AgentCardProps['status']): string {
    if (status === 'running') return 'bg-blue-400 border-blue-400'
    if (status === 'DONE') return 'bg-green-500/60 border-green-500/60'
    if (status === 'DONE_WITH_CONCERNS') return 'bg-yellow-400/70 border-yellow-400/70'
    if (status === 'BLOCKED') return 'bg-red-400/70 border-red-400/70'
    return 'bg-muted-foreground/30 border-muted-foreground/30'
  }

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
        {/* Project name badge */}
        {projectName && (
          <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
            {projectName}
          </span>
        )}
        {isActive && (
          <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
        )}
        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
          {timeAgo(startedAt)}
        </span>
      </button>

      {/* Agent cards — top-level agents with step connectors */}
      {open && (
        <div className="px-3 pb-3">
          {enrichedTopLevel.length > 0 ? (
            <div className="relative pl-4">
              {/* Vertical connector line */}
              {enrichedTopLevel.length > 1 && (
                <div className="absolute left-1.5 top-3 bottom-3 w-px bg-border/40" />
              )}
              {enrichedTopLevel.map((agent, i) => (
                <div key={`${agent.agentName}-${i}`} className="relative mb-2 last:mb-0">
                  {/* Step dot */}
                  {enrichedTopLevel.length > 1 && (
                    <div
                      className={`absolute -left-4 top-3 h-2 w-2 rounded-full border ${stepDotClass(agent.status)}`}
                    />
                  )}
                  <AgentCard {...agent} />
                </div>
              ))}
            </div>
          ) : subAgents.length > 0 ? (
            // Fallback: no top-level agents yet, show sub-agents directly
            <div>
              <p className="text-[10px] text-muted-foreground/50 mb-1 ml-1">Dispatched agents</p>
              <div className="flex flex-col gap-2">
                {subAgents.map((agent, i) => (
                  <div key={`${agent.agentName}-sub-${i}`} className="pl-6">
                    <AgentCard {...agent} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
