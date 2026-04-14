import type { TeammateMessage } from '../../types'
import { formatTimeOfDay } from '../../utils/time'

interface MessageFeedProps {
  messages: TeammateMessage[]
}

function messageTypeColor(type: string): string {
  switch (type) {
    case 'task_claim':      return 'text-sky-400'
    case 'status_update':   return 'text-amber-400'
    case 'peer_message':    return 'text-violet-400'
    case 'idle_event':      return 'text-zinc-400'
    case 'task_completed':  return 'text-emerald-400'
    case 'worktree_created': return 'text-[var(--accent)]'
    default:                return 'text-[var(--text-muted)]'
  }
}


function parsePayloadPreview(payload: string | null): string {
  if (!payload) return ''
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>
    return obj.message as string ?? obj.result as string ?? JSON.stringify(obj).slice(0, 80)
  } catch {
    return payload.slice(0, 80)
  }
}

export function MessageFeed({ messages }: MessageFeedProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-xs text-[var(--text-muted)]">
        No messages yet
      </div>
    )
  }

  return (
    <div className="overflow-y-auto max-h-72 rounded-lg border border-[var(--border)]">
      {messages.map(msg => (
        <div
          key={msg.id}
          className="flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {/* Time */}
          <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0 w-20 pt-0.5">
            {formatTimeOfDay(msg.timestamp) || '—'}
          </span>

          {/* Type */}
          <span className={`text-[10px] font-medium shrink-0 w-28 pt-0.5 ${messageTypeColor(msg.message_type)}`}>
            {msg.message_type}
          </span>

          {/* From/to */}
          <span className="text-[10px] text-[var(--text-secondary)] shrink-0 w-32 pt-0.5 truncate">
            {msg.from_agent ?? '—'}
            {msg.to_agent ? ` → ${msg.to_agent}` : ''}
          </span>

          {/* Payload preview */}
          <span className="flex-1 text-xs text-[var(--text-muted)] truncate min-w-0">
            {parsePayloadPreview(msg.payload)}
          </span>
        </div>
      ))}
    </div>
  )
}
