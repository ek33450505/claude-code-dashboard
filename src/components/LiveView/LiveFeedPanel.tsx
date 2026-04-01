import { useEffect, useRef, useState } from 'react'

export interface FeedEvent {
  id: string
  type: 'spawn' | 'tool' | 'done' | 'blocked' | 'stale' | 'compacted'
  agentName: string
  detail: string
  timestamp: string
}

interface LiveFeedPanelProps {
  events: FeedEvent[]
  connected: boolean
  className?: string
}

const MAX_EVENTS = 200

const TYPE_CONFIG: Record<FeedEvent['type'], { icon: string; iconCls: string }> = {
  spawn:     { icon: '⚡', iconCls: 'text-[var(--accent)]' },
  tool:      { icon: '🔧', iconCls: 'text-blue-400' },
  done:      { icon: '✓',  iconCls: 'text-green-400' },
  blocked:   { icon: '✗',  iconCls: 'text-red-400' },
  stale:     { icon: '⟳',  iconCls: 'text-amber-400' },
  compacted: { icon: '⟳',  iconCls: 'text-amber-400' },
}

function relativeTime(timestamp: string): string {
  const diff = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000))
  if (diff < 60) return `${diff}s`
  const m = Math.floor(diff / 60)
  return `${m}m`
}

export default function LiveFeedPanel({ events, connected, className = '' }: LiveFeedPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isHoveredRef = useRef(false)
  // Slice to max 200 client-side as a safety net
  const visible = events.slice(-MAX_EVENTS)

  // Tick for relative timestamps
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll to bottom when new events arrive, unless hovered
  useEffect(() => {
    if (isHoveredRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [visible.length])

  return (
    <div className={`flex flex-col bg-[var(--bg-primary)] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] flex-shrink-0">
        <span className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">
          Live Feed
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--error)]'
          }`}
        />
      </div>

      {/* Event list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onMouseEnter={() => { isHoveredRef.current = true }}
        onMouseLeave={() => { isHoveredRef.current = false }}
      >
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[var(--text-muted)] text-xs">Waiting for activity…</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visible.map(ev => {
              const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.tool
              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 px-3 py-1.5 hover:bg-[var(--glass)] transition-colors"
                >
                  {/* Relative time */}
                  <span className="w-8 flex-shrink-0 font-mono text-[10px] text-[var(--text-muted)] pt-px">
                    {relativeTime(ev.timestamp)}
                  </span>
                  {/* Icon */}
                  <span className={`flex-shrink-0 text-xs ${cfg.iconCls}`}>
                    {cfg.icon}
                  </span>
                  {/* Agent name */}
                  <span className="flex-shrink-0 text-xs font-medium text-[var(--text-secondary)] max-w-[72px] truncate">
                    {ev.agentName}
                  </span>
                  {/* Detail */}
                  <span className="text-[10px] text-[var(--text-muted)] truncate min-w-0">
                    {ev.detail.slice(0, 40)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
