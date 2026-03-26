import React, { useState } from 'react'
import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import AgentCard, { type AgentCardProps } from './AgentCard'
import type { AgentStatus } from './StatusPill'
import { timeAgo } from '../../utils/time'

export interface DispatchChainProps {
  promptPreview: string
  agents: AgentCardProps[]
  startedAt: string
  isActive: boolean
  defaultExpanded?: boolean
  projectDir?: string
}

// ─── Batch grouping ────────────────────────────────────────────────────────────

function groupIntoBatches(subAgents: AgentCardProps[]): AgentCardProps[][] {
  if (subAgents.length === 0) return []
  const sorted = [...subAgents].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )
  const batches: AgentCardProps[][] = []
  let current: AgentCardProps[] = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].startedAt).getTime()
    const curr = new Date(sorted[i].startedAt).getTime()
    if (curr - prev <= 10_000) {
      current.push(sorted[i])
    } else {
      batches.push(current)
      current = [sorted[i]]
    }
  }
  batches.push(current)
  return batches
}

function batchStatus(agents: AgentCardProps[]): 'running' | 'done' | 'blocked' | 'mixed' {
  const statuses = new Set(agents.map(a => a.status))
  if (statuses.has('running')) return 'running'
  if (statuses.has('BLOCKED')) return 'blocked'
  return 'done'
}

function statusDotClass(status: AgentStatus): string {
  if (status === 'running') return 'bg-blue-400'
  if (status === 'DONE') return 'bg-green-500/60'
  if (status === 'DONE_WITH_CONCERNS') return 'bg-yellow-400/70'
  if (status === 'BLOCKED') return 'bg-red-400/70'
  return 'bg-muted-foreground/30'
}

// ─── BatchRow ─────────────────────────────────────────────────────────────────

interface BatchRowProps {
  batch: AgentCardProps[]
  batchIdx: number
}

function BatchRow({ batch, batchIdx }: BatchRowProps) {
  const status = batchStatus(batch)
  const [batchOpen, setBatchOpen] = useState(status === 'running')

  return (
    <div className="mt-2 pl-4 border-l border-border/30">
      <button
        onClick={() => setBatchOpen(v => !v)}
        className="flex items-center gap-1.5 w-full text-left py-1 hover:text-foreground transition-colors"
      >
        {batchOpen
          ? <ChevronDown size={10} className="text-muted-foreground/60 flex-shrink-0" />
          : <ChevronRight size={10} className="text-muted-foreground/60 flex-shrink-0" />
        }
        <span className="text-[10px] text-muted-foreground font-mono">
          Batch {batchIdx + 1}
        </span>
        {batch.length > 1 && (
          <span className="text-[10px] text-muted-foreground/50">· {batch.length} parallel</span>
        )}
        <div className="flex gap-0.5 ml-1">
          {batch.map((a, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${statusDotClass(a.status)}`} />
          ))}
        </div>
      </button>
      {batchOpen && (
        <div className="flex flex-col gap-1.5 mt-1">
          {batch.map((agent, i) => (
            <AgentCard key={`${agent.agentName}-${i}`} {...agent} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Agent summary pills ──────────────────────────────────────────────────────

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

// ─── DispatchChain ────────────────────────────────────────────────────────────

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

  const projectName = (() => {
    if (!projectDir) return null
    const parts = projectDir.split('--')
    const lastPart = parts[parts.length - 1] ?? ''
    const worktreeMatch = lastPart.match(/claude-worktrees-(.+)$/)
    if (worktreeMatch) return worktreeMatch[1]
    const segs = projectDir.replace(/^-/, '').split('-').filter(Boolean)
    return segs.slice(-3).join('-')
  })()

  // Sort agents by startedAt ascending to show dispatch order
  const sortedAgents = [...agents].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )

  // Separate top-level orchestrators from sub-agents
  const topLevel = sortedAgents.filter(a => !a.isSubagent)
  const subAgents = sortedAgents.filter(a => a.isSubagent)

  // Group sub-agents into batches by time proximity (10s window)
  const batches = groupIntoBatches(subAgents)

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
        {/* Agent summary pills — always visible */}
        {agents.length > 0 && <AgentSummaryPills agents={agents} />}
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

      {/* Agent cards */}
      {open && (
        <div className="px-3 pb-3">
          {topLevel.length > 0 ? (
            <div className="relative pl-4">
              {/* Vertical connector line */}
              {topLevel.length > 1 && (
                <div className="absolute left-1.5 top-3 bottom-3 w-px bg-border/40" />
              )}
              {topLevel.map((agent, i) => (
                <div key={`${agent.agentName}-${i}`} className="relative mb-2 last:mb-0">
                  {/* Step dot */}
                  {topLevel.length > 1 && (
                    <div
                      className={`absolute -left-4 top-3 h-2 w-2 rounded-full border ${stepDotClass(agent.status)}`}
                    />
                  )}
                  <AgentCard {...agent} />
                </div>
              ))}
              {/* Batch-grouped sub-agents below top-level agents */}
              {batches.length > 0 && (
                <div className="mt-1">
                  {batches.map((batch, batchIdx) => (
                    <BatchRow key={batchIdx} batch={batch} batchIdx={batchIdx} />
                  ))}
                </div>
              )}
            </div>
          ) : subAgents.length > 0 ? (
            // No top-level agents yet — show sub-agents in batch groups directly
            <div>
              <p className="text-[10px] text-muted-foreground/50 mb-1 ml-1">Dispatched agents</p>
              {batches.map((batch, batchIdx) => (
                <BatchRow key={batchIdx} batch={batch} batchIdx={batchIdx} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
