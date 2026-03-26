import { useState, useCallback, useRef, useEffect } from 'react'
import { Activity } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import type { LiveEvent, ContentBlock, LogEntry } from '../types'
import { type FeedItem, FeedCard } from '../components/FeedCard'
import DispatchChain from '../components/LiveView/DispatchChain'
import type { DispatchChainProps } from '../components/LiveView/DispatchChain'
import type { AgentCardProps, ToolEvent } from '../components/LiveView/AgentCard'
import type { AgentStatus } from '../components/LiveView/StatusPill'

// ─── Chain state ─────────────────────────────────────────────────────────────

interface ChainState extends DispatchChainProps {
  sessionId: string
  lastModifiedMs: number
}

function extractTextContent(entry: LogEntry): string {
  const c = entry.message?.content
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return (c as ContentBlock[])
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text as string)
      .join('\n')
  }
  return ''
}

function extractStatusFromText(text: string): AgentStatus | 'running' {
  const m = text.match(/^Status:\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)\s*$/im)
  if (!m) return 'running'
  return m[1] as AgentStatus
}

function extractPromptPreview(entry: LogEntry): string {
  const c = entry.message?.content
  if (typeof c === 'string') return c.slice(0, 120)
  if (Array.isArray(c)) {
    const text = (c as ContentBlock[]).find(b => b.type === 'text')?.text
    if (text) return text.slice(0, 120)
  }
  return ''
}

function extractCurrentActivity(entry: LogEntry): string | undefined {
  const blocks = entry.message?.content
  if (!Array.isArray(blocks)) return undefined

  // Check for TodoWrite in_progress item first (use last occurrence if multiple)
  const todoBlock = blocks.filter(b => b.type === 'tool_use' && b.name === 'TodoWrite').at(-1)
  if (todoBlock?.input) {
    const todos = (todoBlock.input as any).todos
    if (Array.isArray(todos)) {
      const active = todos.find((t: any) => t.status === 'in_progress')
      if (active?.activeForm) return active.activeForm
    }
  }

  // Fall back to last tool_use
  const toolBlocks = blocks.filter(b => b.type === 'tool_use')
  const last = toolBlocks[toolBlocks.length - 1]
  if (!last) return undefined

  const name = last.name ?? ''
  const input = last.input as Record<string, unknown> | undefined
  if (name === 'Read' || name === 'Write' || name === 'Edit') {
    const fp = (input?.file_path as string) ?? ''
    return `${name}: ${fp.split('/').slice(-2).join('/')}`
  }
  if (name === 'Bash') {
    const cmd = (input?.command as string) ?? ''
    return `Bash: ${cmd.slice(0, 60)}`
  }
  if (name === 'Grep') {
    return `Grep: ${(input?.pattern as string ?? '').slice(0, 40)}`
  }
  if (name === 'Glob') {
    return `Glob: ${(input?.pattern as string ?? '')}`
  }
  if (name === 'Agent') {
    const desc = (input?.description as string) ?? (input?.subagent_type as string) ?? ''
    return `Dispatch: ${desc.slice(0, 60)}`
  }
  return `${name}: working…`
}

// ─── Toast dedup ─────────────────────────────────────────────────────────────

const lastToastRef: { current: Record<string, number> } = { current: {} }
function shouldToast(key: string): boolean {
  const now = Date.now()
  if (lastToastRef.current[key] && now - lastToastRef.current[key] < 2000) return false
  lastToastRef.current[key] = now
  return true
}

// ─── FeedItem helpers ─────────────────────────────────────────────────────────

function eventToFeedItem(event: LiveEvent): FeedItem | null {
  if (event.type === 'heartbeat') return null

  if (event.type === 'tool_use_event' && event.toolName) {
    return {
      id: `tool-${event.timestamp}-${Math.random()}`,
      type: 'tool_use' as FeedItem['type'],
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      projectDir: event.projectDir,
      preview: event.inputPreview ?? '',
      toolName: event.toolName,
    }
  }

  if (event.type === 'routing_event' && event.event) {
    const re = event.event
    const label = re.command
      ? `→ ${re.command} (${re.matchedRoute})`
      : re.action === 'opus_escalation' ? '→ Opus escalation' : '→ no route'
    return {
      id: `routing-${event.timestamp}-${Math.random()}`,
      type: 'routing_event' as FeedItem['type'],
      timestamp: event.timestamp,
      preview: `${label}: "${re.promptPreview?.slice(0, 80)}"`,
      toolName: re.matchedRoute ?? undefined,
    }
  }

  if (event.lastEntry) {
    const entry = event.lastEntry
    const content = entry.message?.content
    const model = entry.message?.model
    if (typeof content === 'string') {
      return {
        id: entry.uuid || `${event.timestamp}-${Math.random()}`,
        type: event.type === 'agent_spawned' ? 'agent_spawned' : (entry.message?.role === 'user' ? 'user' : 'assistant'),
        timestamp: entry.timestamp || event.timestamp,
        sessionId: event.sessionId,
        projectDir: event.projectDir,
        preview: content.slice(0, 200),
        model,
      }
    }
    if (Array.isArray(content)) {
      const toolUse = (content as ContentBlock[]).find(b => b.type === 'tool_use')
      if (toolUse) {
        return {
          id: entry.uuid || `${event.timestamp}-${Math.random()}`,
          type: 'tool_use',
          timestamp: entry.timestamp || event.timestamp,
          sessionId: event.sessionId,
          projectDir: event.projectDir,
          preview: toolUse.input ? JSON.stringify(toolUse.input).slice(0, 120) : '',
          toolName: toolUse.name,
          model,
        }
      }
      const textBlock = (content as ContentBlock[]).find(b => b.type === 'text')
      if (textBlock?.text) {
        return {
          id: entry.uuid || `${event.timestamp}-${Math.random()}`,
          type: event.type === 'agent_spawned' ? 'agent_spawned' : (entry.message?.role === 'user' ? 'user' : 'assistant'),
          timestamp: entry.timestamp || event.timestamp,
          sessionId: event.sessionId,
          projectDir: event.projectDir,
          preview: textBlock.text.slice(0, 200),
          model,
        }
      }
    }
  }

  return {
    id: `${event.timestamp}-${Math.random()}`,
    type: event.type === 'agent_spawned' ? 'agent_spawned' : 'assistant',
    timestamp: event.timestamp,
    sessionId: event.sessionId,
    projectDir: event.projectDir,
    preview: event.type === 'agent_spawned'
      ? (event.agentType ? `Agent spawned: ${event.agentType}` : 'New agent spawned')
      : 'Session activity',
    toolName: event.agentType ?? undefined,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const CHAIN_HISTORY_KEY = 'cast-chain-history'

function loadChainHistory(): ChainState[] {
  try {
    const raw = localStorage.getItem(CHAIN_HISTORY_KEY)
    if (!raw) return []
    const parsed: ChainState[] = JSON.parse(raw)
    return parsed.map(c => ({ ...c, isActive: false }))
  } catch {
    return []
  }
}

function saveChainHistory(chains: ChainState[]) {
  const toSave = chains
    .slice()
    .sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
    .slice(0, 25)
    .map(c => ({
      ...c,
      isActive: false,
      agents: c.agents.map(a => ({ ...a, currentActivity: undefined })),
    }))
  localStorage.setItem(CHAIN_HISTORY_KEY, JSON.stringify(toSave))
}

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [chains, setChains] = useState<ChainState[]>(loadChainHistory)
  const [rawOpen, setRawOpen] = useState(false)
  // Track which chain index is "most recent" for defaultExpanded
  const chainsRef = useRef<ChainState[]>([])
  chainsRef.current = chains

  // Take over main's scroll so our internal panes can own scroll independently
  useEffect(() => {
    const main = document.querySelector('main') as HTMLElement | null
    if (!main) return
    const prevOverflow = main.style.overflow
    const prevPadding = main.style.padding
    main.style.overflow = 'hidden'
    main.style.padding = '0'
    return () => {
      main.style.overflow = prevOverflow
      main.style.padding = prevPadding
    }
  }, [])

  const ACTIVE_WINDOW_MS = 2 * 60 * 1000  // 2 minutes

  // Persist completed chains to localStorage whenever chains change
  useEffect(() => {
    saveChainHistory(chains)
  }, [chains])

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'heartbeat') return

    const now = Date.now()

    // ── Feed item ──────────────────────────────────────────────────────────
    const feedItem = eventToFeedItem(event)
    if (feedItem) {
      setFeed(prev => [feedItem, ...prev].slice(0, 50))
    }

    // ── Toast ──────────────────────────────────────────────────────────────
    if (event.type === 'agent_spawned' && shouldToast('agent_spawned')) {
      toast('Agent spawned', { description: event.agentType || 'New agent' })
    } else if (event.type === 'session_updated' && shouldToast('session_updated')) {
      const projectName = event.projectDir?.split('/').pop() || 'Unknown project'
      toast('Session updated', { description: projectName })
    } else if (event.type === 'routing_event' && shouldToast('routing_event')) {
      toast('Route dispatched', { description: event.event?.matchedRoute ?? 'no route' })
    }

    // ── Chain update ──────────────────────────────────────────────────────
    const sessionId = event.sessionId
    if (!sessionId) return

    // ── Tool use event — update currentActivity and append to toolEvents ──
    if (event.type === 'tool_use_event' && event.toolName) {
      const activityLabel = `${event.toolName}: ${(event.inputPreview ?? '').slice(0, 60)}`
      const newToolEvent: ToolEvent = {
        id: `tool-${event.timestamp}-${Math.random()}`,
        toolName: event.toolName,
        inputPreview: (event.inputPreview ?? '').slice(0, 80),
        timestamp: event.timestamp,
      }
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c
        return {
          ...c,
          agents: c.agents.map(a => {
            if (a.status !== 'running') return a
            const prevEvents = a.toolEvents ?? []
            // Cap tool events at 50 per agent to avoid unbounded growth
            const updatedEvents = [...prevEvents, newToolEvent].slice(-50)
            return { ...a, currentActivity: activityLabel, lastSeenMs: now, toolEvents: updatedEvents }
          }),
        }
      }))
      return
    }

    // Handle server-side staleness broadcast (outside setChains to avoid nesting)
    if (event.type === 'session_stale') {
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c
        return {
          ...c,
          agents: c.agents.map(a => a.status === 'running' ? { ...a, status: 'stale' as const, currentActivity: undefined } : a),
        }
      }))
      return
    }

    setChains(prev => {
      const next = [...prev]
      const idx = next.findIndex(c => c.sessionId === sessionId)

      if (event.type === 'agent_spawned' && event.agentType) {
        // New agent in this session — always a sub-agent (server sets type=agent_spawned only for subagent paths)
        const newAgent: AgentCardProps = {
          agentName: event.agentType,
          model: undefined,
          status: 'running',
          workLog: undefined,
          startedAt: event.timestamp,
          defaultExpanded: false,
          lastSeenMs: now,
          isSubagent: true,
          agentDescription: event.agentDescription,
          toolEvents: [],
        }

        if (idx === -1) {
          // No parent chain yet — create one to hold this sub-agent
          const chain: ChainState = {
            sessionId,
            promptPreview: event.agentDescription ?? `Agent: ${event.agentType}`,
            agents: [newAgent],
            startedAt: event.timestamp,
            isActive: true,
            defaultExpanded: true,
            lastModifiedMs: now,
          }
          return [chain, ...next]
        } else {
          next[idx] = {
            ...next[idx],
            agents: [newAgent, ...next[idx].agents],
            isActive: true,
            lastModifiedMs: now,
          }
          return next
        }
      }

      if (event.type === 'session_updated' && event.lastEntry) {
        const entry = event.lastEntry
        // Prefer server-extracted agentStatus; fall back to client-side parse
        const status: AgentStatus | 'running' = (event.agentStatus as AgentStatus | undefined) ?? extractStatusFromText(extractTextContent(entry))
        const agentName = event.agentName ?? entry.agentId ?? undefined

        if (idx === -1) {
          // New chain anchored to a user prompt — skip hook feedback messages
          if (entry.message?.role === 'user') {
            const prompt = extractPromptPreview(entry)
            const isHookMsg = /^Stop hook feedback:|^\[Verification Required\]/i.test(prompt)
            if (isHookMsg) return prev
            const chain: ChainState = {
              sessionId,
              promptPreview: prompt,
              agents: [],
              startedAt: event.timestamp,
              isActive: true,
              defaultExpanded: true,
              lastModifiedMs: now,
            }
            return [chain, ...next]
          }
          return prev
        }

        const chain = next[idx]

        // Update an existing agent's status/workLog, or create one if unknown
        if (agentName) {
          const agentIdx = chain.agents.findIndex(a => a.agentName === agentName)
          const existingAgent = agentIdx >= 0 ? chain.agents[agentIdx] : undefined
          const updatedAgent: AgentCardProps = {
            agentName,
            model: entry.message?.model,
            status: status === 'running' ? 'running' : status,
            workLog: event.workLog ?? existingAgent?.workLog,
            startedAt: existingAgent?.startedAt ?? event.timestamp,
            completedAt: status !== 'running' ? event.timestamp : undefined,
            defaultExpanded: existingAgent?.defaultExpanded ?? false,
            currentActivity: status === 'running' ? extractCurrentActivity(entry) : undefined,
            lastSeenMs: now,
            // Preserve fields set at spawn time
            isSubagent: existingAgent?.isSubagent,
            agentDescription: existingAgent?.agentDescription,
            toolEvents: existingAgent?.toolEvents,
          }

          const updatedAgents = agentIdx >= 0
            ? chain.agents.map((a, i) => i === agentIdx ? updatedAgent : a)
            : [updatedAgent, ...chain.agents]

          next[idx] = {
            ...chain,
            agents: updatedAgents,
            isActive: now - chain.lastModifiedMs < ACTIVE_WINDOW_MS,
            lastModifiedMs: now,
          }
        } else if (entry.message?.role === 'user') {
          // User message — update prompt preview if chain has none or has a hook message
          const prompt = extractPromptPreview(entry)
          const isHookMsg = (s: string) => /^Stop hook feedback:|^\[Verification Required\]/i.test(s)
          if (!chain.promptPreview || isHookMsg(chain.promptPreview)) {
            if (!isHookMsg(prompt)) {
              next[idx] = { ...chain, promptPreview: prompt, lastModifiedMs: now }
            }
          }
        } else {
          // Unknown agent — still refresh lastSeenMs on all running agents so they don't go stale,
          // and apply status if the text contains a terminal Status block
          const updatedAgents = chain.agents.map(a => {
            if (a.status !== 'running') return a
            const terminalStatus = status !== 'running' ? status : undefined
            return {
              ...a,
              lastSeenMs: now,
              ...(terminalStatus ? { status: terminalStatus, completedAt: event.timestamp, currentActivity: undefined } : {}),
            }
          })
          next[idx] = { ...chain, agents: updatedAgents, isActive: now - chain.lastModifiedMs < ACTIVE_WINDOW_MS, lastModifiedMs: now }
        }

        return next
      }

      return prev
    })
  }, [ACTIVE_WINDOW_MS])

  const { connected } = useLiveEvents(handleEvent)

  // Re-evaluate isActive on each render based on recency; mark stale running agents
  const displayChains = chains
    .map(c => {
      const isActive = Date.now() - c.lastModifiedMs < ACTIVE_WINDOW_MS
      return {
        ...c,
        isActive,
        agents: c.agents.map(a => {
          const lastSeen = a.lastSeenMs ?? new Date(a.startedAt).getTime()
          const agentStale = a.status === 'running' && Date.now() - lastSeen > 3 * 60 * 1000
          return {
            ...a,
            status: agentStale ? 'stale' as const : a.status,
            currentActivity: agentStale ? undefined : a.currentActivity,
          }
        }),
      }
    })
    .sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
    // Always show active chains; cap past (inactive) chains at 25
    .filter((c, _, arr) => {
      if (c.isActive) return true
      const pastIdx = arr.filter(x => !x.isActive).indexOf(c)
      return pastIdx < 25
    })

  return (
    <div className="flex flex-col h-full overflow-hidden">

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

      {/* Dispatch chains — fills remaining space; scrollable */}
      <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
        {displayChains.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Activity className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
            <p className="text-sm text-[var(--text-muted)] font-medium">No active agents detected</p>
            <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed opacity-70">
              Live tracking scans ~/.claude/projects/ for agent activity in the last 8 minutes. Start a Claude Code session to see dispatch chains here.
            </p>
          </div>
        ) : (
          displayChains.map((chain, i) => (
            <DispatchChain
              key={chain.sessionId}
              promptPreview={chain.promptPreview}
              agents={chain.agents}
              startedAt={chain.startedAt}
              isActive={chain.isActive}
              defaultExpanded={chain.isActive || i === 0}
            />
          ))
        )}
      </div>

      {/* Raw event log — collapsed = label only; open = fixed 40vh pane */}
      <div
        className="flex flex-col border-t border-[var(--border)] px-4 pt-2 pb-2 overflow-hidden flex-shrink-0 transition-all"
        style={{ height: rawOpen ? '40vh' : '2.75rem' }}
      >
        <button
          onClick={() => setRawOpen(v => !v)}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1 text-left"
        >
          <span>{rawOpen ? '▾' : '▸'}</span>
          Raw event log {feed.length > 0 && `(${feed.length})`}
        </button>
        {rawOpen && (
          <div className="mt-2 flex flex-col gap-1 overflow-y-auto flex-1">
            {feed.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-2 text-center">No events yet</p>
            ) : (
              feed.map(item => <FeedCard key={item.id} item={item} />)
            )}
          </div>
        )}
      </div>

    </div>
  )
}
