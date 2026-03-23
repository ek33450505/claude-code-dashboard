import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { useLiveAgents } from '../api/useLiveAgents'
import type { LiveEvent, LogEntry, ContentBlock } from '../types'
import { type FeedItem } from '../components/FeedCard'
import AgentOfficeStrip from '../components/AgentOfficeStrip'
import IntelPanel from '../components/IntelPanel'
import { LOCAL_AGENTS } from '../utils/localAgents'

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
    const toolUse = content.find((b: ContentBlock) => b.type === 'tool_use')
    if (toolUse) {
      return {
        preview: toolUse.input ? JSON.stringify(toolUse.input).slice(0, 120) : '',
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

const lastToastRef: { current: Record<string, number> } = { current: {} }
function shouldToast(eventType: string): boolean {
  const now = Date.now()
  if (lastToastRef.current[eventType] && now - lastToastRef.current[eventType] < 2000) return false
  lastToastRef.current[eventType] = now
  return true
}

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const { data: liveAgents } = useLiveAgents()

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
      const agentLabel = event.agentType ? `Agent spawned: ${event.agentType}` : 'New agent spawned'
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

    if (event.type === 'agent_spawned' && shouldToast('agent_spawned')) {
      toast('Agent spawned', { description: feedItem.toolName || 'New agent', icon: '🤖' })
    } else if (event.type === 'session_updated' && shouldToast('session_updated')) {
      const projectName = event.projectDir?.split('/').pop() || 'Unknown project'
      toast('Session updated', { description: projectName })
    }
  }, [])

  const { connected } = useLiveEvents(handleEvent)

  // Active agent keys — filtered to local agents only
  const liveAgentKeys = (liveAgents ?? [])
    .filter(a => a.isActive)
    .map(a => (a.agentType ?? '').toLowerCase().replace(/\s+/g, '-'))
    .filter(key => LOCAL_AGENTS.includes(key))

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 py-2 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold mr-3">Live Activity</h1>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-[var(--success)] animate-ping' : 'bg-[var(--error)]'} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
          </span>
          <span className="text-xs text-[var(--text-muted)]">{connected ? 'Streaming' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Agent office strip */}
      <AgentOfficeStrip liveAgentNames={liveAgentKeys} />

      {/* Intel panel — fills remaining space */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <IntelPanel feed={feed} onClearFeed={() => setFeed([])} />
      </div>

    </div>
  )
}
