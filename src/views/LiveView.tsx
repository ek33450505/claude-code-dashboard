import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Activity, Clock, Trash2, Server, Layers, DollarSign, Cpu } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { useCastdStatus } from '../api/useCastdControl'
import { useTokenSpend } from '../api/useTokenSpend'
import { useSystemHealth } from '../api/useSystem'
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
  projectDir?: string
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

// ─── Recursive agent tree helpers ────────────────────────────────────────────

// Recursively update an agent by agentId anywhere in a nested agents tree
function updateAgentById(
  agents: AgentCardProps[],
  agentId: string,
  updater: (a: AgentCardProps) => AgentCardProps
): { agents: AgentCardProps[]; found: boolean } {
  let found = false
  const next = agents.map(a => {
    if (a.agentId === agentId) {
      found = true
      return updater(a)
    }
    if (a.subAgents && a.subAgents.length > 0) {
      const result = updateAgentById(a.subAgents, agentId, updater)
      if (result.found) {
        found = true
        return { ...a, subAgents: result.agents }
      }
    }
    return a
  })
  return { agents: next, found }
}

/** Recursively apply display-time stale logic (3-minute threshold, does not mutate state) */
function markDisplayStale(agents: AgentCardProps[]): AgentCardProps[] {
  return agents.map(a => {
    const withChildren = a.subAgents && a.subAgents.length > 0
      ? { ...a, subAgents: markDisplayStale(a.subAgents) }
      : a
    const lastSeen = withChildren.lastSeenMs ?? new Date(withChildren.startedAt).getTime()
    const agentStale = withChildren.status === 'running' && Date.now() - lastSeen > 3 * 60 * 1000
    return {
      ...withChildren,
      status: agentStale ? 'stale' as const : withChildren.status,
      currentActivity: agentStale ? undefined : withChildren.currentActivity,
    }
  })
}

/** Recursively mark running agents as stale if they haven't been seen in 5 minutes */
function markStaleAgents(agents: AgentCardProps[]): AgentCardProps[] {
  return agents.map(a => {
    const withChildren = a.subAgents && a.subAgents.length > 0
      ? { ...a, subAgents: markStaleAgents(a.subAgents) }
      : a
    if (withChildren.status !== 'running') return withChildren
    const lastSeen = withChildren.lastSeenMs ?? new Date(withChildren.startedAt).getTime()
    if (Date.now() - lastSeen > 5 * 60 * 1000) {
      return { ...withChildren, status: 'stale' as const, currentActivity: undefined }
    }
    return withChildren
  })
}

// ─── Activity Status Bar ──────────────────────────────────────────────────────

interface StatusPillProps {
  label: string
  value: string
  status: 'green' | 'yellow' | 'red' | 'neutral'
  icon: React.ComponentType<{ className?: string }>
}

function StatusPill({ label, value, status, icon: Icon }: StatusPillProps) {
  const dotColor = {
    green: 'bg-[var(--success)]',
    yellow: 'bg-amber-400',
    red: 'bg-[var(--error)]',
    neutral: 'bg-[var(--text-muted)]',
  }[status]

  const textColor = {
    green: 'text-[var(--success)]',
    yellow: 'text-amber-400',
    red: 'text-[var(--error)]',
    neutral: 'text-[var(--text-muted)]',
  }[status]

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
      <Icon className={`w-3.5 h-3.5 shrink-0 ${textColor}`} />
      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{label}</span>
      <span className={`text-xs font-mono font-semibold ${textColor} whitespace-nowrap`}>{value}</span>
      <span className={`relative flex h-1.5 w-1.5 shrink-0`}>
        {status === 'green' && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
      </span>
    </div>
  )
}

interface ActivityStatusBarProps {
  daemonRunning: boolean
  queueDepth: number
  sessionCostUSD: number
  ollamaConnected: boolean
}

function ActivityStatusBar({ daemonRunning, queueDepth, sessionCostUSD, ollamaConnected }: ActivityStatusBarProps) {
  const queueStatus: StatusPillProps['status'] = queueDepth > 15 ? 'red' : queueDepth > 4 ? 'yellow' : 'green'

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)] overflow-x-auto">
      <StatusPill
        label="Daemon"
        value={daemonRunning ? 'running' : 'stopped'}
        status={daemonRunning ? 'green' : 'red'}
        icon={Server}
      />
      <StatusPill
        label="Queue"
        value={String(queueDepth)}
        status={queueStatus}
        icon={Layers}
      />
      <StatusPill
        label="Today"
        value={`$${sessionCostUSD.toFixed(2)}`}
        status="neutral"
        icon={DollarSign}
      />
      <StatusPill
        label="Ollama"
        value={ollamaConnected ? 'connected' : 'offline'}
        status={ollamaConnected ? 'green' : 'neutral'}
        icon={Cpu}
      />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

const CHAIN_HISTORY_KEY = 'cast-chain-history'
const ACTIVE_WINDOW_MS = 2 * 60 * 1000  // 2 minutes — chain considered active within this window

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

function stripCurrentActivity(agents: AgentCardProps[]): AgentCardProps[] {
  return agents.map(a => ({
    ...a,
    currentActivity: undefined,
    subAgents: a.subAgents && a.subAgents.length > 0 ? stripCurrentActivity(a.subAgents) : a.subAgents,
  }))
}

function saveChainHistory(chains: ChainState[]) {
  const toSave = chains
    .slice()
    .sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
    .slice(0, 25)
    .map(c => ({
      ...c,
      isActive: false,
      agents: stripCurrentActivity(c.agents),
    }))
  localStorage.setItem(CHAIN_HISTORY_KEY, JSON.stringify(toSave))
}

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [chains, setChains] = useState<ChainState[]>(loadChainHistory)
  const [rawOpen, setRawOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // ── OS Activity Monitor data ──────────────────────────────────────────────
  const { data: castdStatus } = useCastdStatus()
  const { data: tokenSpend } = useTokenSpend()
  const { data: sysHealth } = useSystemHealth()

  const todayCostUSD = useMemo(() => {
    if (!tokenSpend?.daily) return 0
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    return entry?.costUsd ?? 0
  }, [tokenSpend])

  const ollamaConnected = useMemo(() => {
    const env = sysHealth?.env
    if (!env) return false
    return !!(env.OLLAMA_HOST || env.OLLAMA_BASE_URL)
  }, [sysHealth])
  // Ticker forces a re-render every 30s so stale/isActive derived state updates
  // even when no SSE events are arriving (agents that finished silently).
  // Also mutates chains state so stale agents persist to localStorage rather than
  // reloading as 'running' on the next page load.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1)
      setChains(prev => prev.map(c => ({
        ...c,
        agents: markStaleAgents(c.agents),
      })))
    }, 30_000)
    return () => clearInterval(id)
  }, [])
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

  // Persist completed chains to localStorage whenever chains change
  useEffect(() => {
    saveChainHistory(chains)
  }, [chains])

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'heartbeat') return

    const now = Date.now()

    // ── command_queued — add to feed, fire toast ────────────────────────────
    if (event.type === 'command_queued') {
      const feedItem: FeedItem = {
        id: `cmd-${event.timestamp}-${Math.random()}`,
        type: 'routing_event',
        timestamp: event.timestamp,
        preview: `Command queued: ${event.commandType ?? 'unknown'} (${event.commandId?.slice(0, 8) ?? '?'})`,
        toolName: event.commandType,
      }
      setFeed(prev => [feedItem, ...prev].slice(0, 50))
      if (shouldToast('command_queued')) {
        toast('Command queued', { description: event.commandType ?? 'dashboard command' })
      }
      return
    }

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
        const subagentId = event.subagentId

        if (subagentId) {
          // Exact match by subagentId — update only that agent (search recursively through nested subAgents)
          const { agents: updatedAgents, found } = updateAgentById(c.agents, subagentId, a => {
            const prevEvents = a.toolEvents ?? []
            const updatedEvents = [...prevEvents, newToolEvent].slice(-50)
            return { ...a, currentActivity: activityLabel, lastSeenMs: now, toolEvents: updatedEvents }
          })
          if (found) {
            return { ...c, agents: updatedAgents }
          }
          return c
        }

        // No subagentId — find the single most-recently-active running agent
        const runningAgents = c.agents
          .map((a, idx) => ({ a, idx }))
          .filter(({ a }) => a.status === 'running')
        if (runningAgents.length === 0) return c

        // Pick agent with highest lastSeenMs; break ties by earliest index
        const target = runningAgents.reduce((best, cur) => {
          const bestMs = best.a.lastSeenMs ?? 0
          const curMs = cur.a.lastSeenMs ?? 0
          if (curMs > bestMs) return cur
          return best
        })

        return {
          ...c,
          agents: c.agents.map((a, idx) => {
            if (idx !== target.idx) return a
            const prevEvents = a.toolEvents ?? []
            const updatedEvents = [...prevEvents, newToolEvent].slice(-50)
            return { ...a, currentActivity: activityLabel, lastSeenMs: now, toolEvents: updatedEvents }
          }),
        }
      }))
      return
    }

    // ── session_complete — idle timer fired; mark running agents as DONE ──
    if (event.type === 'session_complete') {
      const completedStatus = (event.status ?? 'DONE') as AgentStatus
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c

        // Route by subagentId first (most reliable) — search recursively through nested subAgents
        if (event.subagentId) {
          const { agents: updatedAgents, found } = updateAgentById(c.agents, event.subagentId, a => {
            // Complete running or stale agents — a stale agent that finished should show terminal state
            if (a.status !== 'running' && a.status !== 'stale') return a
            return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
          })
          if (found) {
            return { ...c, agents: updatedAgents }
          }
        }

        // Fall back to agentName match when subagentId absent but agentName present
        if (event.agentName) {
          return {
            ...c,
            agents: c.agents.map(a => {
              if (a.agentName !== event.agentName) return a
              if (a.status !== 'running' && a.status !== 'stale') return a
              return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
            }),
          }
        }

        // Neither present — top-level orchestrator session; mark ALL running/stale agents DONE
        return {
          ...c,
          agents: c.agents.map(a => {
            if (a.status !== 'running' && a.status !== 'stale') return a
            return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
          }),
        }
      }))
      return
    }

    // Handle server-side staleness broadcast (outside setChains to avoid nesting)
    if (event.type === 'session_stale') {
      const markAllRunningStale = (agents: AgentCardProps[]): AgentCardProps[] =>
        agents.map(a => ({
          ...(a.status === 'running' ? { ...a, status: 'stale' as const, currentActivity: undefined } : a),
          subAgents: a.subAgents && a.subAgents.length > 0 ? markAllRunningStale(a.subAgents) : a.subAgents,
        }))
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c
        return {
          ...c,
          agents: markAllRunningStale(c.agents),
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
          agentId: event.subagentId,
          parentAgentId: event.parentAgentId,
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
        }

        const chain = next[idx]

        // Deferred attribution patch: second event with parentAgentId for an already-added top-level agent
        if (event.parentAgentId && event.subagentId) {
          const existingTopLevelIdx = chain.agents.findIndex(a => a.agentId === event.subagentId)
          if (existingTopLevelIdx >= 0) {
            // Agent already exists at top level — move it into the parent's subAgents
            const agentToMove = { ...chain.agents[existingTopLevelIdx], parentAgentId: event.parentAgentId }
            const withoutMoved = chain.agents.filter((_, i) => i !== existingTopLevelIdx)
            const { agents: movedAgents, found } = updateAgentById(withoutMoved, event.parentAgentId, parent => ({
              ...parent,
              subAgents: [...(parent.subAgents ?? []), agentToMove],
            }))
            next[idx] = {
              ...chain,
              agents: found ? movedAgents : chain.agents.map((a, i) => i === existingTopLevelIdx ? agentToMove : a),
              isActive: true,
              lastModifiedMs: now,
            }
            return next
          }
        }

        // First event: nest under parent if parentAgentId is known, otherwise add to chain.agents
        if (event.parentAgentId) {
          const { agents: updatedAgents, found } = updateAgentById(chain.agents, event.parentAgentId, parent => ({
            ...parent,
            subAgents: [...(parent.subAgents ?? []), newAgent],
          }))
          next[idx] = {
            ...chain,
            agents: found ? updatedAgents : [newAgent, ...chain.agents],
            isActive: true,
            lastModifiedMs: now,
          }
        } else {
          next[idx] = {
            ...chain,
            agents: [newAgent, ...chain.agents],
            isActive: true,
            lastModifiedMs: now,
          }
        }
        return next
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
              projectDir: event.projectDir,
            }
            return [chain, ...next]
          }
          return prev
        }

        const chain = next[idx]

        // Update an existing agent's status/workLog, or create one if unknown
        if (agentName) {
          // Try to find the agent anywhere in the tree (handles sub-agents moved by deferred attribution)
          let existingAgent: AgentCardProps | undefined
          const findAgent = (agents: AgentCardProps[]): AgentCardProps | undefined => {
            for (const a of agents) {
              if (a.agentName === agentName) return a
              if (a.subAgents && a.subAgents.length > 0) {
                const found = findAgent(a.subAgents)
                if (found) return found
              }
            }
            return undefined
          }
          existingAgent = findAgent(chain.agents)

          // Terminal statuses that must not be overridden by post-completion JSONL entries
          const TERMINAL: AgentStatus[] = ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT', 'stale']

          const buildUpdatedAgent = (existing: AgentCardProps | undefined): AgentCardProps => {
            // If the new event has no terminal status, preserve the existing one — prevents
            // post-completion JSONL entries (tool results, system lines) from resetting a
            // DONE/BLOCKED agent back to 'running'.
            const resolvedStatus: AgentStatus | 'running' =
              status !== 'running' ? status
              : (existing && TERMINAL.includes(existing.status as AgentStatus) ? existing.status : 'running')
            return ({
            agentName,
            agentId: existing?.agentId,
            model: entry.message?.model,
            status: resolvedStatus,
            workLog: event.workLog ?? existing?.workLog,
            startedAt: existing?.startedAt ?? event.timestamp,
            completedAt: resolvedStatus !== 'running' ? (existing?.completedAt ?? event.timestamp) : undefined,
            defaultExpanded: existing?.defaultExpanded ?? false,
            currentActivity: resolvedStatus === 'running' ? extractCurrentActivity(entry) : undefined,
            lastSeenMs: now,
            // Preserve fields set at spawn time
            isSubagent: existing?.isSubagent,
            parentAgentId: existing?.parentAgentId,
            agentDescription: existing?.agentDescription,
            toolEvents: existing?.toolEvents,
            subAgents: existing?.subAgents,
          })}

          let updatedAgents: AgentCardProps[]
          if (existingAgent?.agentId) {
            // Agent found by agentId somewhere in the tree — use recursive updater
            const { agents: recursed, found } = updateAgentById(chain.agents, existingAgent.agentId, buildUpdatedAgent)
            updatedAgents = found ? recursed : [buildUpdatedAgent(undefined), ...chain.agents]
          } else if (existingAgent) {
            // Found by name at top level — flat update
            updatedAgents = chain.agents.map(a => a.agentName === agentName ? buildUpdatedAgent(a) : a)
          } else {
            // New agent not yet in tree — prepend at top level
            updatedAgents = [buildUpdatedAgent(undefined), ...chain.agents]
          }

          next[idx] = {
            ...chain,
            agents: updatedAgents,
            isActive: now - chain.lastModifiedMs < ACTIVE_WINDOW_MS,
            lastModifiedMs: now,
            projectDir: chain.projectDir ?? event.projectDir,
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
          // Unknown agent — refresh lastSeenMs on running OR stale agents (new activity un-stales them),
          // and apply status if the text contains a terminal Status block
          const updatedAgents = chain.agents.map(a => {
            // Only touch agents that could still be active (running or stale — not terminal)
            const isTerminal = a.status !== 'running' && a.status !== 'stale'
            if (isTerminal) return a
            const terminalStatus = status !== 'running' ? status : undefined
            return {
              ...a,
              // If the agent was stale and new activity arrived, restore it to running
              status: terminalStatus ?? (a.status === 'stale' ? 'running' as const : a.status),
              lastSeenMs: now,
              ...(terminalStatus ? { completedAt: event.timestamp, currentActivity: undefined } : { currentActivity: a.currentActivity }),
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
        agents: markDisplayStale(c.agents),
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

      {/* OS Activity Monitor — Status Bar */}
      <ActivityStatusBar
        daemonRunning={castdStatus?.running ?? false}
        queueDepth={castdStatus?.queueDepth ?? 0}
        sessionCostUSD={todayCostUSD}
        ollamaConnected={ollamaConnected}
      />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-4 py-2 border-b border-[var(--border)]">
        <h1 className="text-xl font-bold mr-3">Activity Monitor</h1>
        <div className="flex items-center gap-1.5 flex-1">
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
        ) : (() => {
          const activeChains = displayChains.filter(c => c.isActive)
          const pastChains = displayChains.filter(c => !c.isActive)
          return (
            <>
              {/* Active chains */}
              {activeChains.map(chain => (
                <DispatchChain
                  key={chain.sessionId}
                  promptPreview={chain.promptPreview}
                  agents={chain.agents}
                  startedAt={chain.startedAt}
                  isActive={true}
                  defaultExpanded={true}
                  projectDir={chain.projectDir}
                />
              ))}

              {/* Empty state when no active chains */}
              {activeChains.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <Activity className="w-6 h-6 text-[var(--text-muted)] opacity-30" />
                  <p className="text-xs text-[var(--text-muted)] opacity-60">No active sessions</p>
                </div>
              )}

              {/* History — collapsible section */}
              {pastChains.length > 0 && (
                <div className="border-t border-[var(--border)] pt-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setHistoryOpen(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      <Clock size={11} />
                      <span>{historyOpen ? '▾' : '▸'}</span>
                      <span>History ({pastChains.length})</span>
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem(CHAIN_HISTORY_KEY)
                        setChains(prev => prev.filter(c => {
                          const isActive = Date.now() - c.lastModifiedMs < ACTIVE_WINDOW_MS
                          return isActive
                        }))
                        toast.success('History cleared')
                      }}
                      className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--error)] transition-colors px-1.5 py-0.5 rounded"
                      title="Clear history"
                    >
                      <Trash2 size={11} />
                      <span>Clear</span>
                    </button>
                  </div>
                  {historyOpen && (
                    <div className="space-y-2">
                      {pastChains.map(chain => (
                        <DispatchChain
                          key={chain.sessionId}
                          promptPreview={chain.promptPreview}
                          agents={chain.agents}
                          startedAt={chain.startedAt}
                          isActive={false}
                          defaultExpanded={false}
                          projectDir={chain.projectDir}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}
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
