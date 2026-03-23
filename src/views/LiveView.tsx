import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { useLiveAgents } from '../api/useLiveAgents'
import type { LiveEvent, LogEntry, ContentBlock } from '../types'
import { type FeedItem } from '../components/FeedCard'
import GameWorld, { type GameWorldHandle } from '../components/GameWorld'
import { AgentDetailOverlay } from '../components/AgentDetailOverlay'
import { OfficeHUD } from '../components/OfficeHUD'
import { RoomNav } from '../components/RoomNav'
import SidePanel from '../components/SidePanel'
import { ROOMS } from '../engine/rooms'
import { AGENT_PERSONALITIES } from '../utils/agentPersonalities'
import type { AgentEntity } from '../engine/AgentEntity'

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

  // New fullscreen layout state
  const gameWorldRef = useRef<GameWorldHandle>(null)
  const [selectedAgent, setSelectedAgent] = useState<{
    agent: AgentEntity
    pos: { screenX: number; screenY: number }
  } | null>(null)
  const [sidePanelOpen, setSidePanelOpen] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState('Core')

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

  // Map live agents to OfficeHUD format
  const hudAgents = (liveAgents ?? [])
    .filter(a => a.isActive)
    .map(a => {
      const key = (a.agentType ?? 'general-purpose').toLowerCase().replace(/\s+/g, '-')
      const personality = AGENT_PERSONALITIES[key] ?? AGENT_PERSONALITIES['general-purpose']
      return {
        name: a.agentType ?? 'agent',
        accentColor: personality.accentColor,
        task: a.taskPrompt,
        model: a.model,
      }
    })

  return (
    <div className="relative flex flex-col h-full">

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
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

        {/* INTEL side panel toggle */}
        <button
          onClick={() => { setSidePanelOpen(true); setSelectedAgent(null) }}
          className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5">
            {feed.length > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />}
            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${feed.length > 0 ? 'bg-amber-400' : 'bg-[var(--text-muted)]'}`} />
          </span>
          INTEL {feed.length > 0 && `(${feed.length})`} ≡
        </button>
      </header>

      {/* Canvas — fills all remaining height */}
      <div className="relative flex-1 min-h-0">
        <GameWorld
          ref={gameWorldRef}
          className="w-full h-full"
          onAgentClick={(entity, pos) => {
            setSelectedAgent(entity && pos ? { agent: entity, pos } : null)
          }}
        />

        {/* Room nav dots — absolute over canvas */}
        <RoomNav
          rooms={ROOMS}
          activeRoomId={activeRoomId}
          onRoomSelect={(id) => {
            gameWorldRef.current?.jumpToRoom(id)
            setActiveRoomId(id)
          }}
        />

        {/* Agent detail overlay */}
        {selectedAgent && (
          <AgentDetailOverlay
            agent={{
              name: selectedAgent.agent.name,
              accentColor: selectedAgent.agent.accentColor,
              state: selectedAgent.agent.state,
              isLive: selectedAgent.agent.isLive,
            }}
            screenPos={selectedAgent.pos}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      {/* Floating HUD — fixed position */}
      <OfficeHUD
        activeAgents={hudAgents}
        onOpenPanel={() => setSidePanelOpen(true)}
      />

      {/* Slide-in side panel */}
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        feed={feed}
        onClearFeed={() => setFeed([])}
      />

    </div>
  )
}
