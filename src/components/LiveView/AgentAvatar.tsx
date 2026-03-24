import React from 'react'
import { AGENT_PERSONALITIES } from '../../utils/agentPersonalities'

interface AgentAvatarProps {
  agentName: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const SIZE_CLASSES = {
  sm: { outer: 'w-6 h-6', text: 'text-[10px]' },
  md: { outer: 'w-8 h-8', text: 'text-xs' },
  lg: { outer: 'w-10 h-10', text: 'text-sm' },
}

function getInitials(name: string): string {
  const parts = name.split('-').filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function resolveColor(agentName: string): string {
  const personality = AGENT_PERSONALITIES[agentName] ?? AGENT_PERSONALITIES['general-purpose']
  return personality?.accentColor ?? '#6b7280'
}

export default function AgentAvatar({ agentName, size = 'md', showLabel = false }: AgentAvatarProps) {
  const color = resolveColor(agentName)
  const initials = getInitials(agentName)
  const { outer, text } = SIZE_CLASSES[size]

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${outer} rounded-full flex items-center justify-center flex-shrink-0`}
        style={{ background: color }}
        title={agentName}
      >
        <span className={`${text} font-bold text-white leading-none`}>{initials}</span>
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-foreground">{agentName}</span>
      )}
    </div>
  )
}
