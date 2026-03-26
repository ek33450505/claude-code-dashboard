import React, { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight, Users, Check, X, Wrench } from 'lucide-react'
import AgentCard, { type AgentCardProps } from './AgentCard'
import StatusPill, { type AgentStatus } from './StatusPill'
import { timeAgo } from '../../utils/time'

export interface PendingApproval {
  chainId: string
  batchDescription?: string
}

export interface DispatchChainProps {
  promptPreview: string
  agents: AgentCardProps[]
  startedAt: string
  isActive: boolean
  defaultExpanded?: boolean
  projectDir?: string
  pendingApproval?: PendingApproval
}

// ─── Agent summary pills ──────────────────────────────────────────────────────

function statusDotClass(status: AgentStatus): string {
  if (status === 'running') return 'bg-blue-400'
  if (status === 'DONE') return 'bg-green-500/60'
  if (status === 'DONE_WITH_CONCERNS') return 'bg-yellow-400/70'
  if (status === 'BLOCKED') return 'bg-red-400/70'
  return 'bg-muted-foreground/30'
}

function AgentSummaryPills({ agents }: { agents: AgentCardProps[] }) {
  const running = agents.filter(a => a.status === 'running').length
  const done = agents.filter(a => a.status === 'DONE' || a.status === 'DONE_WITH_CONCERNS').length
  const blocked = agents.filter(a => a.status === 'BLOCKED').length
  const stale = agents.filter(a => a.status === 'stale').length

  if (agents.length === 0) return null

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {running > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/15 text-blue-400">
          {running} running
        </span>
      )}
      {done > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-green-500/15 text-green-400">
          {done} done
        </span>
      )}
      {blocked > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-red-500/15 text-red-400">
          {blocked} blocked
        </span>
      )}
      {stale > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted/40 text-muted-foreground/60">
          {stale} stale
        </span>
      )}
    </div>
  )
}

// ─── SubAgentSection ──────────────────────────────────────────────────────────

function SubAgentRow({ agent }: { agent: AgentCardProps }) {
  const toolCount = agent.toolEvents?.length ?? 0
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded bg-[var(--bg-secondary,hsl(var(--muted)/0.3))] border border-[var(--border)] border-opacity-40">
      {/* Agent type */}
      <span className="text-[10px] font-semibold font-mono text-foreground/80 flex-1 truncate min-w-0">
        {agent.agentName}
      </span>
      {/* Status pill */}
      <StatusPill status={agent.status} />
      {/* Tool count */}
      {toolCount > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
          <Wrench size={8} className="opacity-50" />
          {toolCount}
        </span>
      )}
    </div>
  )
}

function SubAgentSection({ subAgents, hasRunning }: { subAgents: AgentCardProps[], hasRunning: boolean }) {
  const [open, setOpen] = useState(hasRunning)

  return (
    <div className="mt-2 pl-4 border-l border-border/30">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 w-full text-left py-1 hover:text-foreground transition-colors"
      >
        {open
          ? <ChevronDown size={10} className="text-muted-foreground/60 flex-shrink-0" />
          : <ChevronRight size={10} className="text-muted-foreground/60 flex-shrink-0" />
        }
        <Users size={10} className="text-muted-foreground/60 flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground font-mono">
          Sub-agents ({subAgents.length})
        </span>
        <div className="flex gap-0.5 ml-1">
          {subAgents.map((a, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${statusDotClass(a.status)}`} />
          ))}
        </div>
      </button>
      {open && (
        <div className="flex flex-col gap-1 mt-1">
          {subAgents.map((agent, i) => (
            <SubAgentRow key={`${agent.agentName}-${i}`} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── BatchApprovalBar ─────────────────────────────────────────────────────────

function BatchApprovalBar({ chainId, batchDescription }: { chainId: string; batchDescription?: string }) {
  const [acted, setActed] = useState(false)
  const [loading, setLoading] = useState(false)

  async function act(action: 'approve' | 'reject') {
    if (loading || acted) return
    setLoading(true)
    try {
      await fetch(`/api/control/batch/${encodeURIComponent(chainId)}/${action}`, { method: 'POST' })
      setActed(true)
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }

  if (acted) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t border-[var(--border)] bg-amber-500/5">
      {batchDescription && (
        <span className="text-[11px] text-amber-400/80 flex-1 truncate">{batchDescription}</span>
      )}
      {!batchDescription && (
        <span className="text-[11px] text-amber-400/80 flex-1">Awaiting batch approval</span>
      )}
      <button
        onClick={() => act('reject')}
        disabled={loading}
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
      >
        <X size={11} /> Reject
      </button>
      <button
        onClick={() => act('approve')}
        disabled={loading}
        className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-colors"
      >
        <Check size={11} /> Approve
      </button>
    </div>
  )
}

// ─── DispatchChain ────────────────────────────────────────────────────────────

export default function DispatchChain({
  promptPreview,
  agents,
  startedAt,
  isActive,
  defaultExpanded = false,
  projectDir,
  pendingApproval,
}: DispatchChainProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const preview = promptPreview.slice(0, 120)

  const projectName = (() => {
    if (!projectDir) return null
    const parts = projectDir.split('--')
    const lastPart = parts[parts.length - 1] ?? ''
    const worktreeMatch = lastPart.match(/claude-worktrees-(.+)$/)
    if (worktreeMatch) return worktreeMatch[1]
    const segs = projectDir.replace(/^-/, '').split('-').filter(Boolean)
    return segs.slice(-3).join('-')
  })()

  const sortedAgents = [...agents].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )

  const topLevel = sortedAgents.filter(a => !a.isSubagent)
  const subAgents = sortedAgents.filter(a => a.isSubagent)
  const hasRunningSubAgents = subAgents.some(a => a.status === 'running')

  // Separate orchestrator(s) from co-agents so orchestrators render one level above
  const orchestrators = topLevel.filter(a => a.agentName.toLowerCase().includes('orchestrat'))
  const coAgents = topLevel.filter(a => !a.agentName.toLowerCase().includes('orchestrat'))
  const hasOrchestrator = orchestrators.length > 0

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
        {agents.length > 0 && <AgentSummaryPills agents={agents} />}
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

      {/* Agent cards */}
      {open && (
        <div className="px-3 pb-3">
          {hasOrchestrator ? (
            // 3-level hierarchy: orchestrator → co-agents → sub-agents
            <div className="relative pl-4">
              {orchestrators.length > 1 && (
                <div className="absolute left-1.5 top-3 bottom-3 w-px bg-border/40" />
              )}
              {orchestrators.map((agent, i) => (
                <div key={`${agent.agentName}-${i}`} className="relative mb-2 last:mb-0">
                  {orchestrators.length > 1 && (
                    <div className={`absolute -left-4 top-3 h-2 w-2 rounded-full border ${stepDotClass(agent.status)}`} />
                  )}
                  <AgentCard
                    {...agent}
                    subagentCount={(coAgents.length + subAgents.length) > 0 ? (coAgents.length + subAgents.length) : undefined}
                  />
                </div>
              ))}
              {/* Co-agents: dispatched by orchestrator, one level below */}
              {(coAgents.length > 0 || subAgents.length > 0) && (
                <div className="mt-1 pl-4 border-l border-border/30 flex flex-col gap-2">
                  {coAgents.map((agent, i) => (
                    <AgentCard
                      key={`${agent.agentName}-co-${i}`}
                      {...agent}
                      subagentCount={undefined}
                    />
                  ))}
                  {subAgents.length > 0 && (
                    <SubAgentSection subAgents={subAgents} hasRunning={hasRunningSubAgents} />
                  )}
                </div>
              )}
            </div>
          ) : topLevel.length > 0 ? (
            // No orchestrator: flat layout (original behavior)
            <div className="relative pl-4">
              {topLevel.length > 1 && (
                <div className="absolute left-1.5 top-3 bottom-3 w-px bg-border/40" />
              )}
              {topLevel.map((agent, i) => (
                <div key={`${agent.agentName}-${i}`} className="relative mb-2 last:mb-0">
                  {topLevel.length > 1 && (
                    <div className={`absolute -left-4 top-3 h-2 w-2 rounded-full border ${stepDotClass(agent.status)}`} />
                  )}
                  <AgentCard
                    {...agent}
                    subagentCount={subAgents.length > 0 ? subAgents.length : undefined}
                  />
                </div>
              ))}
              {subAgents.length > 0 && (
                <SubAgentSection subAgents={subAgents} hasRunning={hasRunningSubAgents} />
              )}
            </div>
          ) : subAgents.length > 0 ? (
            <SubAgentSection subAgents={subAgents} hasRunning={hasRunningSubAgents} />
          ) : null}
        </div>
      )}

      {/* Batch approval bar — shown when a gate is pending */}
      {pendingApproval && (
        <BatchApprovalBar
          chainId={pendingApproval.chainId}
          batchDescription={pendingApproval.batchDescription}
        />
      )}
    </div>
  )
}
