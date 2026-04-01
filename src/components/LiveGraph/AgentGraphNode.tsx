import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { getAgentCategory, CATEGORY_COLORS } from '../../utils/agentCategories'

export interface AgentNodeData {
  agentName: string
  status: 'running' | 'DONE' | 'DONE_WITH_CONCERNS' | 'BLOCKED' | 'stale' | 'pending'
  model?: string
  depth: number
  currentActivity?: string
  startedAt: string
  completedAt?: string
  selected?: boolean
}

interface AgentGraphNodeProps {
  data: AgentNodeData
}

function getCircleStyle(status: AgentNodeData['status']): React.CSSProperties {
  switch (status) {
    case 'running':
      return {
        border: '2px solid var(--accent)',
        boxShadow: '0 0 16px rgba(0,255,194,0.4)',
        background: 'var(--bg-secondary)',
      }
    case 'DONE':
    case 'DONE_WITH_CONCERNS':
      return {
        border: '1px solid rgba(52,211,153,0.4)',
        background: 'rgba(52,211,153,0.1)',
        opacity: 0.8,
      }
    case 'BLOCKED':
      return {
        border: '1px solid rgba(248,113,113,0.4)',
        background: 'rgba(248,113,113,0.1)',
      }
    case 'stale':
      return {
        border: '1px solid rgba(251,191,36,0.4)',
        background: 'rgba(251,191,36,0.1)',
        opacity: 0.7,
      }
    case 'pending':
    default:
      return {
        border: '1px dashed var(--border)',
        background: 'var(--bg-primary)',
      }
  }
}

function getTextColor(status: AgentNodeData['status']): string {
  switch (status) {
    case 'running': return 'text-[var(--accent)]'
    case 'DONE':
    case 'DONE_WITH_CONCERNS': return 'text-green-400'
    case 'BLOCKED': return 'text-red-400'
    case 'stale': return 'text-amber-400'
    default: return 'text-[var(--text-muted)]'
  }
}

export default function AgentGraphNode({ data }: AgentGraphNodeProps) {
  const { agentName, status, depth, currentActivity } = data

  const size = depth === 0 ? 44 : depth === 1 ? 32 : 24
  const circleStyle = getCircleStyle(status)
  const textColor = getTextColor(status)

  const category = getAgentCategory(agentName)
  const categoryColor = category ? CATEGORY_COLORS[category].text : 'text-[var(--accent)]'

  const initials = agentName.slice(0, 2).toUpperCase()
  const fontSize = depth === 0 ? 'text-[10px]' : 'text-[9px]'

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ minWidth: size + 32 }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className={`flex items-center justify-center rounded-full ${textColor}`}
          style={{ width: size, height: size, ...circleStyle }}
        >
          <span className={`${fontSize} font-bold ${categoryColor}`}>{initials}</span>
        </div>

        {status === 'running' && (
          <div
            className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"
            style={{ transform: 'translate(25%, -25%)' }}
          />
        )}
      </div>

      <span className={`text-xs font-medium text-[var(--text-primary)] max-w-[80px] truncate text-center leading-tight`}>
        {agentName}
      </span>

      {status === 'running' && currentActivity && (
        <span className="font-mono text-[9px] text-[var(--text-muted)] truncate max-w-[120px] text-center">
          {currentActivity.slice(0, 36)}
        </span>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
