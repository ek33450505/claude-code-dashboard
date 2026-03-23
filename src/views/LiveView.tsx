import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { timeAgo } from '../utils/time'
import type { LiveEvent, LogEntry, ContentBlock } from '../types'
import LiveAgentsPanel from '../components/LiveAgentsPanel'
import DelegationChain from '../components/DelegationChain'
import AgentOffice from '../components/AgentOffice'

interface FeedItem {
  id: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'agent_spawned' | 'heartbeat' | 'routing_event'
  timestamp: string
  sessionId?: string
  projectDir?: string
  preview: string
  toolName?: string
  model?: string
}

function extractPreview(entry: LogEntry): { preview: string; type: FeedItem['type']; toolName?: string; model?: string } {
  const content = entry.message?.content
  const model = entry.message?.model

  if (typeof content === 'string') {
    return {
      preview: content.slice(0, 200),
      type: entry.message?.role === 'user' ? 'user' : 'assistant',
      model,
    }
  }

  if (Array.isArray(content)) {
    // Check for tool_use blocks first (most interesting)
    const toolUse = content.find((b: ContentBlock) => b.type === 'tool_use')
    if (toolUse) {
      const inputPreview = toolUse.input
        ? JSON.stringify(toolUse.input).slice(0, 120)
        : ''
      return {
        preview: inputPreview,
        type: 'tool_use',
        toolName: toolUse.name,
        model,
      }
    }

    const toolResult = content.find((b: ContentBlock) => b.type === 'tool_result')
    if (toolResult) {
      return {
        preview: typeof toolResult.text === 'string' ? toolResult.text.slice(0, 200) : 'Result received',
        type: 'tool_result',
        model,
      }
    }

    // Text blocks
    const textBlock = content.find((b: ContentBlock) => b.type === 'text')
    if (textBlock?.text) {
      return {
        preview: textBlock.text.slice(0, 200),
        type: entry.message?.role === 'user' ? 'user' : 'assistant',
        model,
      }
    }
  }

  if (entry.type === 'progress') {
    return { preview: entry.data?.type || 'Progress update', type: 'assistant' }
  }

  return { preview: 'Activity detected', type: 'assistant' }
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

function FeedCard({ item }: { item: FeedItem }) {
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

function ActiveSessionBadge({ session }: { session: { projectName: string; sessionId: string; lastModified: number } }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-4 py-3">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--success)]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {session.projectName}
        </p>
        <p className="text-xs text-[var(--text-muted)] font-mono truncate">
          {session.sessionId.slice(0, 8)}...
        </p>
      </div>
    </div>
  )
}

// Toast debounce: max one toast per event type per 2 seconds
const lastToastRef: { current: Record<string, number> } = { current: {} }
function shouldToast(eventType: string): boolean {
  const now = Date.now()
  if (lastToastRef.current[eventType] && now - lastToastRef.current[eventType] < 2000) {
    return false
  }
  lastToastRef.current[eventType] = now
  return true
}

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const feedRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [feedOpen, setFeedOpen] = useState(true)

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'heartbeat') return

    if (event.type === 'routing_event' && event.event) {
      const re = event.event
      const label = re.command
        ? `→ ${re.command} (${re.matchedRoute})`
        : re.action === 'opus_escalation' ? '→ Opus escalation' : '→ no route'
      setFeed(prev => [{
        id: `routing-${event.timestamp}-${Math.random()}`,
        type: 'routing_event' as FeedItem['type'],
        timestamp: event.timestamp,
        preview: `${label}: "${re.promptPreview?.slice(0, 80)}"`,
        toolName: re.matchedRoute ?? undefined,
      }, ...prev].slice(0, 100))
      if (shouldToast('routing_event')) {
        toast('Route dispatched', { description: re.matchedRoute ?? 'no route' })
      }
      return
    }

    let feedItem: FeedItem

    if (event.lastEntry) {
      const { preview, type, toolName, model } = extractPreview(event.lastEntry)
      feedItem = {
        id: event.lastEntry.uuid || `${event.timestamp}-${Math.random()}`,
        type: event.type === 'agent_spawned' ? 'agent_spawned' : type,
        timestamp: event.lastEntry.timestamp || event.timestamp,
        sessionId: event.sessionId,
        projectDir: event.projectDir,
        preview,
        toolName,
        model,
      }
    } else {
      const agentLabel = event.agentType
        ? `Agent spawned: ${event.agentType}`
        : 'New agent spawned'
      feedItem = {
        id: `${event.timestamp}-${Math.random()}`,
        type: event.type === 'agent_spawned' ? 'agent_spawned' : 'assistant',
        timestamp: event.timestamp,
        sessionId: event.sessionId,
        projectDir: event.projectDir,
        preview: event.type === 'agent_spawned'
          ? (event.agentDescription ? `${agentLabel} — ${event.agentDescription}` : agentLabel)
          : 'Session activity',
        toolName: event.agentType ?? undefined,
      }
    }

    setFeed(prev => [feedItem, ...prev].slice(0, 100))

    // Fire toasts for key events (debounced)
    if (event.type === 'agent_spawned' && shouldToast('agent_spawned')) {
      toast('Agent spawned', { description: feedItem.toolName || 'New agent', icon: '🤖' })
    } else if (event.type === 'session_updated' && shouldToast('session_updated')) {
      const projectName = event.projectDir?.split('/').pop() || 'Unknown project'
      toast('Session updated', { description: projectName })
    }
  }, [])

  const { connected } = useLiveEvents(handleEvent)

  // Auto-scroll to top when new items arrive
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = 0
    }
  }, [feed.length, autoScroll])

  return (
    <div className="flex flex-col gap-3">

      {/* Compact header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Live Activity</h1>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-[var(--success)] animate-ping' : 'bg-[var(--error)]'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
            </span>
            <span className="text-xs text-[var(--text-muted)]">{connected ? 'Streaming' : 'Disconnected'}</span>
          </div>
        </div>
        {/* Activity log toggle */}
        <button
          onClick={() => setFeedOpen(o => !o)}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            {feed.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${feed.length > 0 ? 'bg-amber-400' : 'bg-[var(--text-muted)]'}`} />
          </span>
          Activity Log {feed.length > 0 && `(${feed.length})`}
          <span className="text-[var(--text-muted)]">{feedOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {/* CAST HQ Office — primary focus */}
      <AgentOffice />

      {/* Live zone: war room + missions */}
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <LiveAgentsPanel />
        </div>
        <div className="w-72 shrink-0">
          <DelegationChain />
        </div>
      </div>

      {/* Activity log — collapsed by default */}
      {feedOpen && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Activity Log</span>
            <button
              onClick={() => setFeed([])}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          </div>
          <div
            ref={feedRef}
            className="overflow-y-auto space-y-2 max-h-64 p-3"
            onScroll={(e) => {
              const el = e.currentTarget
              setAutoScroll(el.scrollTop === 0)
            }}
          >
            {feed.length === 0 ? (
              <p className="text-xs text-center text-[var(--text-muted)] py-4">No events yet</p>
            ) : (
              feed.map((item) => <FeedCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      )}

    </div>
  )
}
