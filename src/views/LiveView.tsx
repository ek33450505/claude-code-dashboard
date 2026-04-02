import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useLiveEvents } from '../api/useLive'
import { useTokenSpend } from '../api/useTokenSpend'
import { useAgentRuns } from '../api/useAgentRuns'
import type { AgentRun } from '../api/useAgentRuns'
import { useActiveAgents } from '../api/useActiveAgents'
import type { LiveEvent, ContentBlock, LogEntry, FeedItem } from '../types'
import type { AgentCardProps, ToolEvent } from '../components/LiveView/AgentCard'
import type { AgentStatus } from '../components/LiveView/StatusPill'
import type { DispatchChainProps } from '../components/LiveView/DispatchChain'
import type { AgentStageData } from '../components/LiveView/AgentStage'
import StatusBar from '../components/LiveView/StatusBar'
import LiveFeedPanel from '../components/LiveView/LiveFeedPanel'
import SessionGroupList, { type SessionGroup } from '../components/LiveView/SessionGroupList'
import WorktreeAgentsSection from '../components/LiveView/WorktreeAgentsSection'

// ─── Chain state ─────────────────────────────────────────────────────────────

interface ChainState extends DispatchChainProps {
  sessionId: string
  lastModifiedMs: number
  projectDir?: string
  projectName?: string
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

  const todoBlock = blocks.filter(b => b.type === 'tool_use' && b.name === 'TodoWrite').at(-1)
  if (todoBlock?.input) {
    const todos = (todoBlock.input as any).todos
    if (Array.isArray(todos)) {
      const active = todos.find((t: any) => t.status === 'in_progress')
      if (active?.activeForm) return active.activeForm
    }
  }

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

// ─── Recursive agent tree helpers ────────────────────────────────────────────

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

// ─── Chain state persistence ──────────────────────────────────────────────────

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

// ─── Data mapping helpers ─────────────────────────────────────────────────────

export function agentCardToStageData(a: AgentCardProps): AgentStageData {
  return {
    agentName: a.agentName,
    status: a.status as AgentStageData['status'],
    model: a.model ?? undefined,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    currentActivity: a.currentActivity,
    children: a.subAgents && a.subAgents.length > 0
      ? a.subAgents.map(agentCardToStageData)
      : undefined,
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

// ─── db-sourced chain completion helpers ─────────────────────────────────────

const TERMINAL_STATUSES = new Set(['done', 'done_with_concerns', 'blocked', 'failed'])

function buildCompletedChains(runs: AgentRun[]) {
  if (runs.length === 0) return []

  const bySession = new Map<string, AgentRun[]>()
  for (const run of runs) {
    const key = run.session_id ?? 'unknown'
    const arr = bySession.get(key) ?? []
    arr.push(run)
    bySession.set(key, arr)
  }

  const result = []

  for (const [sessionId, sessionRuns] of bySession) {
    const allTerminal = sessionRuns.every(r => TERMINAL_STATUSES.has(r.status.toLowerCase().replace(/ /g, '_')))
    if (!allTerminal) continue

    const sorted = [...sessionRuns].sort(
      (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    )
    const first = sorted[0]
    const last = sorted[sorted.length - 1]

    const startMs = new Date(first.started_at).getTime()
    const endMs = last.ended_at ? new Date(last.ended_at).getTime() : null
    const durationMs = endMs ? endMs - startMs : null

    const hasBlocked = sessionRuns.some(r => {
      const s = r.status.toLowerCase().replace(/ /g, '_')
      return s === 'blocked' || s === 'failed'
    })

    const projectName = first.project ?? sessionId.slice(0, 8)

    result.push({
      chainId: sessionId,
      projectName,
      agentCount: sessionRuns.length,
      duration: durationMs !== null ? formatDuration(durationMs) : '?',
      status: hasBlocked ? 'BLOCKED' : 'DONE',
      completedAt: last.ended_at ?? last.started_at,
    })
  }

  return result
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 30)
}

// ─── Main LiveView ────────────────────────────────────────────────────────────

const ACTIVE_WINDOW_MS = 2 * 60 * 1000

export default function LiveView() {
  const [chains, setChains] = useState<ChainState[]>(loadChainHistory)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])

  const queryClient = useQueryClient()
  const { data: activeAgentsData } = useActiveAgents()

  const { data: tokenSpend } = useTokenSpend()

  const twoHoursAgo = useMemo(() => {
    return new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }, [])

  const { data: runsData } = useAgentRuns({ since: twoHoursAgo, limit: 100, refetchInterval: 30_000 })

  const totalCostUsd = useMemo(() => {
    if (!tokenSpend?.daily) return 0
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    return entry?.costUsd ?? 0
  }, [tokenSpend])

  const tokensPerHr = useMemo(() => {
    if (!tokenSpend?.daily) return 0
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    if (!entry) return 0
    return entry.inputTokens + entry.outputTokens
  }, [tokenSpend])

  const tokensPerMin = Math.round(tokensPerHr / 60)

  // Take over main scroll
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

  // Persist completed chains
  useEffect(() => {
    saveChainHistory(chains)
  }, [chains])

  // 30s stale ticker
  useEffect(() => {
    const id = setInterval(() => {
      setChains(prev => prev.map(c => ({
        ...c,
        agents: markStaleAgents(c.agents),
      })))
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const chainsRef = useRef<ChainState[]>([])
  chainsRef.current = chains

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'db_change_agent_run') {
      if (event.dbChangeStatus === 'running') {
        queryClient.invalidateQueries({ queryKey: ['cast', 'active-agents'] })
      }
      return
    }

    if (event.type === 'hook_event' && event.hookEventName) {
      setFeedItems(prev => [{
        id: `hook-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: event.hookAgentName ?? 'hook',
        description: `${event.hookEventName}${event.hookTrigger ? ` (${event.hookTrigger})` : ''}`,
        timestamp: Date.now(),
        sessionId: event.sessionId ?? 'system',
      }, ...prev].slice(0, 100))
      return
    }

    if (event.type === 'command_queued' && event.commandType) {
      setFeedItems(prev => [{
        id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: 'dashboard',
        description: `command queued: ${event.commandType}`,
        timestamp: Date.now(),
        sessionId: 'system',
      }, ...prev].slice(0, 100))
      return
    }

    if (event.type === 'heartbeat') return

    const now = Date.now()

    // ── Toast notifications ──────────────────────────────────────────────────

    if (event.type === 'agent_spawned' && shouldToast('agent_spawned')) {
      toast('Agent spawned', { description: event.agentType || 'New agent' })
    } else if (event.type === 'session_updated' && shouldToast('session_updated')) {
      const projectName = event.projectDir?.split('/').pop() || 'Unknown project'
      toast('Session updated', { description: projectName })
    } else if (event.type === 'routing_event' && shouldToast('routing_event')) {
      toast('Route dispatched', { description: event.event?.matchedRoute ?? 'no route' })
    }

    const sessionId = event.sessionId
    if (!sessionId) return

    // ── Tool use → update currentActivity ───────────────────────────────────

    if (event.type === 'tool_use_event' && event.toolName) {
      const activityLabel = `${event.toolName}: ${(event.inputPreview ?? '').slice(0, 60)}`
      const newToolEvent: ToolEvent = {
        id: `tool-${event.sessionId ?? 'x'}-${event.timestamp}-${event.toolName ?? ''}`,
        toolName: event.toolName,
        inputPreview: (event.inputPreview ?? '').slice(0, 80),
        timestamp: event.timestamp,
      }
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c
        const subagentId = event.subagentId

        if (subagentId) {
          const { agents: updatedAgents, found } = updateAgentById(c.agents, subagentId, a => {
            const prevEvents = a.toolEvents ?? []
            const updatedEvents = [...prevEvents, newToolEvent].slice(-50)
            return { ...a, currentActivity: activityLabel, lastSeenMs: now, toolEvents: updatedEvents }
          })
          if (found) return { ...c, agents: updatedAgents }
          return c
        }

        const runningAgents = c.agents
          .map((a, idx) => ({ a, idx }))
          .filter(({ a }) => a.status === 'running')
        if (runningAgents.length === 0) return c

        const target = runningAgents.reduce((best, cur) => {
          const bestMs = best.a.lastSeenMs ?? 0
          const curMs = cur.a.lastSeenMs ?? 0
          return curMs > bestMs ? cur : best
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

      const toolFeedItem: FeedItem = {
        id: `tool_use_event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: event.agentType ?? event.subagentId?.slice(0, 8) ?? 'agent',
        description: `${event.toolName}: ${(event.inputPreview ?? '').slice(0, 60)}`,
        timestamp: Date.now(),
        sessionId,
      }
      setFeedItems(prev => [toolFeedItem, ...prev].slice(0, 100))
      return
    }

    // ── session_complete ─────────────────────────────────────────────────────

    if (event.type === 'session_complete') {
      const completedStatus = (event.status ?? 'DONE') as AgentStatus
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c

        if (event.subagentId) {
          const { agents: updatedAgents, found } = updateAgentById(c.agents, event.subagentId, a => {
            if (a.status !== 'running' && a.status !== 'stale') return a
            return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
          })
          if (found) return { ...c, agents: updatedAgents }
        }

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

        return {
          ...c,
          agents: c.agents.map(a => {
            if (a.status !== 'running' && a.status !== 'stale') return a
            return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
          }),
        }
      }))

      const completeFeedItem: FeedItem = {
        id: `session_complete-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: event.agentType ?? 'session',
        description: `completed — ${event.status ?? 'done'}`,
        timestamp: Date.now(),
        sessionId,
        isTerminal: true,
      }
      setFeedItems(prev => [completeFeedItem, ...prev].slice(0, 100))
      setTimeout(() => setChains(prev => prev.filter(c => c.sessionId !== sessionId)), 2000)
      return
    }

    // ── routing_event feed item ──────────────────────────────────────────────

    if (event.type === 'routing_event') {
      const routingFeedItem: FeedItem = {
        id: `routing_event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: event.agentType ?? 'router',
        description: `dispatched ${event.event?.matchedRoute ?? event.agentName ?? 'agent'}`,
        timestamp: Date.now(),
        sessionId,
      }
      setFeedItems(prev => [routingFeedItem, ...prev].slice(0, 100))
    }

    // ── session_stale ────────────────────────────────────────────────────────

    if (event.type === 'session_stale') {
      const markAllRunningStale = (agents: AgentCardProps[]): AgentCardProps[] =>
        agents.map(a => ({
          ...(a.status === 'running' ? { ...a, status: 'stale' as const, currentActivity: undefined } : a),
          subAgents: a.subAgents && a.subAgents.length > 0 ? markAllRunningStale(a.subAgents) : a.subAgents,
        }))
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c
        return { ...c, agents: markAllRunningStale(c.agents) }
      }))
      return
    }

    // ── agent_spawned / session_updated ──────────────────────────────────────

    setChains(prev => {
      const next = [...prev]
      const idx = next.findIndex(c => c.sessionId === sessionId)

      if (event.type === 'agent_spawned' && event.agentType) {
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
          const chain: ChainState = {
            sessionId,
            promptPreview: event.agentDescription ?? `Agent: ${event.agentType}`,
            agents: [newAgent],
            startedAt: event.timestamp,
            isActive: true,
            defaultExpanded: true,
            lastModifiedMs: now,
            projectDir: event.projectDir,
            projectName: event.projectName,
          }
          return [chain, ...next]
        }

        const chain = next[idx]

        if (event.parentAgentId && event.subagentId) {
          const existingTopLevelIdx = chain.agents.findIndex(a => a.agentId === event.subagentId)
          if (existingTopLevelIdx >= 0) {
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
        const status: AgentStatus | 'running' = (event.agentStatus as AgentStatus | undefined) ?? extractStatusFromText(extractTextContent(entry))
        const agentName = event.agentName ?? entry.agentId ?? undefined

        if (idx === -1) {
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
              projectName: event.projectName,
            }
            return [chain, ...next]
          }
          return prev
        }

        const chain = next[idx]

        if (agentName) {
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

          const TERMINAL: AgentStatus[] = ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED', 'NEEDS_CONTEXT', 'stale']

          const buildUpdatedAgent = (existing: AgentCardProps | undefined): AgentCardProps => {
            const resolvedStatus: AgentStatus | 'running' =
              status !== 'running' ? status
              : (existing && TERMINAL.includes(existing.status as AgentStatus) ? existing.status : 'running')
            return {
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
              isSubagent: existing?.isSubagent,
              parentAgentId: existing?.parentAgentId,
              agentDescription: existing?.agentDescription,
              toolEvents: existing?.toolEvents,
              subAgents: existing?.subAgents,
            }
          }

          let updatedAgents: AgentCardProps[]
          if (existingAgent?.agentId) {
            const { agents: recursed, found } = updateAgentById(chain.agents, existingAgent.agentId, buildUpdatedAgent)
            updatedAgents = found ? recursed : [buildUpdatedAgent(undefined), ...chain.agents]
          } else if (existingAgent) {
            updatedAgents = chain.agents.map(a => a.agentName === agentName ? buildUpdatedAgent(a) : a)
          } else {
            updatedAgents = [buildUpdatedAgent(undefined), ...chain.agents]
          }

          next[idx] = {
            ...chain,
            agents: updatedAgents,
            isActive: now - chain.lastModifiedMs < ACTIVE_WINDOW_MS,
            lastModifiedMs: now,
            projectDir: chain.projectDir ?? event.projectDir,
            projectName: chain.projectName ?? event.projectName,
          }
        } else if (entry.message?.role === 'user') {
          const prompt = extractPromptPreview(entry)
          const isHookMsg = (s: string) => /^Stop hook feedback:|^\[Verification Required\]/i.test(s)
          if (!chain.promptPreview || isHookMsg(chain.promptPreview)) {
            if (!isHookMsg(prompt)) {
              next[idx] = { ...chain, promptPreview: prompt, lastModifiedMs: now }
            }
          }
        } else {
          const updatedAgents = chain.agents.map(a => {
            const isTerminal = a.status !== 'running' && a.status !== 'stale'
            if (isTerminal) return a
            const terminalStatus = status !== 'running' ? status : undefined
            return {
              ...a,
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

    // ── Feed items for agent_spawned and session_updated ─────────────────────

    if (event.type === 'agent_spawned') {
      const spawnFeedItem: FeedItem = {
        id: `agent_spawned-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: event.agentType ?? 'agent',
        description: `started — ${event.agentDescription ?? 'new agent'}`,
        timestamp: Date.now(),
        sessionId,
      }
      setFeedItems(prev => [spawnFeedItem, ...prev].slice(0, 100))
    }

    if (event.type === 'session_updated') {
      const role = event.lastEntry?.message?.role
      const content = event.lastEntry
        ? (() => {
            const c = event.lastEntry.message?.content
            if (typeof c === 'string') return c.slice(0, 80)
            if (Array.isArray(c)) {
              const text = (c as ContentBlock[]).find(b => b.type === 'text')?.text
              return text ? text.slice(0, 80) : ''
            }
            return ''
          })()
        : ''
      const sessionFeedItem: FeedItem = {
        id: `session_updated-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agentName: role === 'assistant' ? (event.agentName ?? 'session') : 'session',
        description: event.lastEntry ? (content || 'active') : 'active',
        timestamp: Date.now(),
        sessionId,
      }
      setFeedItems(prev => [sessionFeedItem, ...prev].slice(0, 100))
    }
  }, [queryClient])

  const { connected } = useLiveEvents(handleEvent)

  // ─── Derived display data ─────────────────────────────────────────────────

  const displayChains = useMemo(() => {
    return chains
      .map(c => {
        const isActive = Date.now() - c.lastModifiedMs < ACTIVE_WINDOW_MS
        return {
          ...c,
          isActive,
          agents: markDisplayStale(c.agents),
        }
      })
      .sort((a, b) => new Date(a.startedAt ?? 0).getTime() - new Date(b.startedAt ?? 0).getTime())
      .filter(c => {
        if (c.isActive) return true
        // Only show inactive sessions from the last 30 minutes
        return Date.now() - c.lastModifiedMs < 30 * 60 * 1000
      })
  }, [chains])

  const activeChainCount = useMemo(() => {
    return displayChains.filter(c => c.isActive && c.agents.some(a => a.status === 'running')).length
  }, [displayChains])

  const sessionGroups = useMemo((): SessionGroup[] => {
    return displayChains.map(c => ({
      sessionId: c.sessionId,
      projectDir: c.projectDir,
      projectName: c.projectName,
      startedAt: c.startedAt ?? new Date(c.lastModifiedMs).toISOString(),
      lastModifiedMs: c.lastModifiedMs,
      isActive: c.isActive,
      agents: c.agents,
    }))
  }, [displayChains])

  const worktreeRuns = useMemo(() => {
    if (!activeAgentsData) return []
    const knownAgentNames = new Set(
      chains.flatMap(c => c.agents.map(a => a.agentName))
    )
    return activeAgentsData.filter(r =>
      r.status === 'running' && !knownAgentNames.has(r.agent)
    )
  }, [activeAgentsData, chains])

  // Current session ID from most recently active chain
  const currentSessionId = useMemo(() => {
    const active = displayChains.find(c => c.isActive)
    return active?.sessionId
  }, [displayChains])

  // Suppress unused import warning — runsData used for future HistoryStrip
  void buildCompletedChains(runsData?.runs ?? [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <StatusBar
        connected={connected}
        activeCount={activeChainCount}
        costUsd={totalCostUsd}
        tokensPerMin={tokensPerMin}
        sessionId={currentSessionId}
      />
      <div className="flex-1 overflow-auto p-4">
        <SessionGroupList sessions={sessionGroups} />
        <WorktreeAgentsSection runs={worktreeRuns} />
        <LiveFeedPanel items={feedItems} connected={connected} />
      </div>
    </div>
  )
}
