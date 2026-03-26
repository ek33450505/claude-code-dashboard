import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import AgentAvatar from './AgentAvatar'
import StatusPill from './StatusPill'
import type { AgentNodeData } from '../../utils/graphLayout'

function formatElapsed(start: string, end?: string): string {
  const a = new Date(start).getTime()
  const b = end ? new Date(end).getTime() : Date.now()
  const secs = Math.round((b - a) / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return rem ? `${mins}m ${rem}s` : `${mins}m`
}

function getModelTierStyle(model?: string): { label: string; className: string } | null {
  if (!model) return null
  if (model.includes('haiku')) return { label: 'Haiku', className: 'bg-cyan-500/15 text-cyan-400' }
  if (model.includes('opus')) return { label: 'Opus', className: 'bg-amber-500/15 text-amber-400' }
  if (model.includes('sonnet')) return { label: 'Sonnet', className: 'bg-purple-500/15 text-purple-400' }
  return null
}

function statusBarColor(status: string): string {
  if (status === 'running') return 'bg-blue-400'
  if (status === 'DONE') return 'bg-green-500'
  if (status === 'DONE_WITH_CONCERNS') return 'bg-yellow-400'
  if (status === 'BLOCKED') return 'bg-red-400'
  if (status === 'stale') return 'bg-zinc-500'
  return 'bg-muted-foreground/30'
}

function statusGlow(status: string): string {
  if (status === 'running') return 'shadow-[0_0_0_2px_rgba(96,165,250,0.35)]'
  if (status === 'DONE') return 'shadow-[0_0_0_2px_rgba(34,197,94,0.25)]'
  if (status === 'BLOCKED') return 'shadow-[0_0_0_2px_rgba(248,113,113,0.35)]'
  return ''
}

export default function AgentNode({ data }: NodeProps) {
  const { agent } = data as AgentNodeData
  const {
    agentName,
    model,
    status,
    startedAt,
    completedAt,
    currentActivity,
    toolEvents = [],
  } = agent

  // Live-updating elapsed timer for running agents
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt, completedAt))
  useEffect(() => {
    if (status !== 'running') {
      setElapsed(formatElapsed(startedAt, completedAt))
      return
    }
    const id = setInterval(() => {
      setElapsed(formatElapsed(startedAt))
    }, 1000)
    return () => clearInterval(id)
  }, [status, startedAt, completedAt])

  const modelTier = getModelTierStyle(model)
  const barColor = statusBarColor(status)
  const glow = statusGlow(status)
  const toolCount = toolEvents.length
  const lastActivity = currentActivity ?? (toolEvents.length > 0 ? `${toolEvents[toolEvents.length - 1].toolName}: ${toolEvents[toolEvents.length - 1].inputPreview}` : undefined)

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div
        className={`relative w-full rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer select-none ${glow}`}
      >
        {/* Status bar — left edge */}
        {status === 'running' ? (
          <motion.div
            className={`absolute left-0 top-0 bottom-0 w-[3px] ${barColor}`}
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
          />
        ) : (
          <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${barColor}`} />
        )}

        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 pl-4">
          <AgentAvatar agentName={agentName} size="sm" />
          <span className="text-[11px] font-semibold text-foreground flex-1 truncate">{agentName}</span>
          <StatusPill status={status} />
        </div>

        {/* Body */}
        <div className="px-3 pl-4 pb-2 flex flex-col gap-1">
          {/* Elapsed + last activity */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums">{elapsed}</span>
            {toolCount > 0 && (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {toolCount} tool{toolCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {lastActivity && (
            <p className="text-[10px] text-muted-foreground font-mono truncate opacity-70">
              {lastActivity}
            </p>
          )}
        </div>

        {/* Footer — model tier */}
        {modelTier && (
          <div className="px-3 pl-4 pb-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${modelTier.className}`}>
              {modelTier.label}
            </span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </>
  )
}
