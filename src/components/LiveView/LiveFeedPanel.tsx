import { FeedItem } from '@/types'
import { useEffect, useState } from 'react'
import { getBadgeColor } from './agentColors'

interface Props {
  items: FeedItem[]
  connected: boolean
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}

export function LiveFeedPanel({ items, connected }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-xs font-mono font-semibold tracking-widest text-muted-foreground uppercase">
          Live Activity
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm font-mono">
          No active sessions
        </div>
      ) : (
        <div className="divide-y divide-border">
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-opacity ${item.isTerminal ? 'opacity-50' : ''}`}
            >
              <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${getBadgeColor(item.agentName)}`}>
                {item.agentName}
              </span>
              <span className="flex-1 text-foreground truncate">{item.description}</span>
              <span className="shrink-0 text-xs text-muted-foreground font-mono whitespace-nowrap">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default LiveFeedPanel
