import { timeAgo } from '../utils/time'

export interface FeedItem {
  id: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'agent_spawned' | 'heartbeat' | 'routing_event'
  timestamp: string
  sessionId?: string
  projectDir?: string
  preview: string
  toolName?: string
  model?: string
}

const TYPE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  user: { dot: 'bg-blue-400', label: 'User', bg: 'bg-blue-500/10 border-blue-500/20' },
  assistant: { dot: 'bg-indigo-400', label: 'Assistant', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  tool_use: { dot: 'bg-amber-400', label: 'Tool Call', bg: 'bg-amber-500/10 border-amber-500/20' },
  tool_result: { dot: 'bg-emerald-400', label: 'Tool Result', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  agent_spawned: { dot: 'bg-purple-400', label: 'Agent Spawned', bg: 'bg-purple-500/10 border-purple-500/20' },
  heartbeat: { dot: 'bg-gray-500', label: 'Heartbeat', bg: 'bg-gray-500/10 border-gray-500/20' },
  routing_event: { dot: 'bg-cyan-400', label: 'Routed', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  agent_dispatch: { dot: 'bg-purple-400', label: 'Agent Dispatch', bg: 'bg-purple-500/10 border-purple-500/20' },
}

export function FeedCard({ item }: { item: FeedItem }) {
  const style = TYPE_STYLES[item.type] || TYPE_STYLES.assistant

  return (
    <div className={`rounded-xl border px-5 py-4 ${style.bg} transition-all animate-in`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {style.label}
        </span>
        {item.toolName && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-amber-300">
            {item.toolName}
          </span>
        )}
        {item.model && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {item.model}
          </span>
        )}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {timeAgo(item.timestamp)}
        </span>
      </div>
      <p className="text-sm text-[var(--text-primary)] line-clamp-3 font-mono leading-relaxed break-all">
        {item.preview}
      </p>
    </div>
  )
}
