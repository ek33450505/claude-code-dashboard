import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Activity, Clock, Trash2, Server, Layers, DollarSign, Cpu, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { useCastdStatus } from '../api/useCastdControl'
import { useTokenSpend } from '../api/useTokenSpend'
import { useTaskQueue } from '../api/useTaskQueue'
import { useAgentRuns } from '../api/useAgentRuns'
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
      id: `tool-${event.sessionId ?? 'x'}-${event.timestamp}-${event.toolName ?? ''}`,
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
      id: `routing-${event.sessionId ?? 'x'}-${event.timestamp}`,
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
        id: entry.uuid || `${event.type}-${event.sessionId ?? 'x'}-${event.timestamp}`,
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
          id: entry.uuid || `tool_use-${event.sessionId ?? 'x'}-${event.timestamp}`,
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
          id: entry.uuid || `${event.type}-${event.sessionId ?? 'x'}-${event.timestamp}-text`,
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
    id: `${event.type}-${event.sessionId ?? 'x'}-${event.timestamp}`,
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

interface VitalCardProps {
  label: string
  value: string
  subValue?: string
  status: 'green' | 'yellow' | 'red' | 'neutral' | 'purple' | 'cyan'
  icon: React.ComponentType<{ className?: string }>
}

function VitalCard({ label, value, subValue, status, icon: Icon }: VitalCardProps) {
  const colorMap = {
    green: { text: 'text-[var(--success)]', dot: 'bg-[var(--success)]', border: 'border-[var(--success)]/20', bg: 'bg-[var(--success)]/5' },
    yellow: { text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-400/20', bg: 'bg-amber-400/5' },
    red: { text: 'text-[var(--error)]', dot: 'bg-[var(--error)]', border: 'border-[var(--error)]/20', bg: 'bg-[var(--error)]/5' },
    neutral: { text: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]', border: 'border-[var(--border)]', bg: '' },
    purple: { text: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5' },
    cyan: { text: 'text-cyan-400', dot: 'bg-cyan-400', border: 'border-cyan-400/20', bg: 'bg-cyan-400/5' },
  }[status]

  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 rounded-lg border ${colorMap.border} ${colorMap.bg} bg-[var(--bg-secondary)] min-w-[100px]`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3 h-3 shrink-0 ${colorMap.text}`} />
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap">{label}</span>
      </div>
      <div className={`text-sm font-bold font-mono ${colorMap.text} whitespace-nowrap`}>{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">{subValue ?? '\u00A0'}</div>
    </div>
  )
}

interface ActivityStatusBarProps {
  daemonRunning: boolean
  queueDepth: number
  activeAgents: number
  sessionCostUSD: number
  tokensPerHr: number
}

function ActivityStatusBar({ daemonRunning, queueDepth, activeAgents, sessionCostUSD, tokensPerHr }: ActivityStatusBarProps) {
  const queueStatus: VitalCardProps['status'] = queueDepth > 15 ? 'red' : queueDepth > 4 ? 'yellow' : 'neutral'

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)] overflow-x-auto">
      <VitalCard
        label="Active Agents"
        value={String(activeAgents)}
        status={activeAgents > 0 ? 'green' : 'neutral'}
        icon={Activity}
      />
      <VitalCard
        label="Pending Tasks"
        value={String(queueDepth)}
        status={queueStatus}
        icon={Layers}
      />
      <VitalCard
        label="$/today"
        value={`$${sessionCostUSD.toFixed(2)}`}
        status="purple"
        icon={DollarSign}
      />
      <VitalCard
        label="Tokens/hr"
        value={tokensPerHr > 999 ? `${(tokensPerHr / 1000).toFixed(1)}k` : String(tokensPerHr)}
        status="purple"
        icon={Cpu}
      />
      <VitalCard
        label="Daemon"
        value={daemonRunning ? 'running' : 'stopped'}
        status={daemonRunning ? 'green' : 'red'}
        icon={Server}
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

// ─── Task Queue Panel ─────────────────────────────────────────────────────────

type TaskStatus = 'pending' | 'claimed' | 'done' | 'failed'

const TASK_STATUS_ORDER: TaskStatus[] = ['pending', 'claimed', 'done', 'failed']
const TASK_STATUS_ICON: Record<TaskStatus, string> = {
  pending: '○',
  claimed: '◐',
  done: '●',
  failed: '✕',
}
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  pending: 'text-amber-400',
  claimed: 'text-blue-400',
  done: 'text-[var(--text-muted)]',
  failed: 'text-[var(--error)]',
}

function TaskQueuePanel() {
  const { data: taskQueueData } = useTaskQueue()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['done', 'failed']))

  const grouped = useMemo(() => {
    type TaskList = NonNullable<typeof taskQueueData>['tasks']
    if (!taskQueueData?.tasks) return { pending: [], claimed: [], done: [], failed: [] } as Record<TaskStatus, TaskList>
    const result: Record<TaskStatus, TaskList> = { pending: [], claimed: [], done: [], failed: [] }
    for (const task of taskQueueData.tasks) {
      const s = task.status as TaskStatus
      if (s in result) result[s].push(task)
    }
    return result
  }, [taskQueueData])

  const toggleGroup = (status: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  if (!taskQueueData) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-[var(--text-muted)]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)]">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">{taskQueueData?.source === 'agent_runs' ? 'Recent Agent Runs' : 'Task Queue'}</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {TASK_STATUS_ORDER.map(status => {
          const tasks = grouped[status] ?? []
          const isCollapsed = collapsed.has(status)
          return (
            <div key={status} className="border-b border-[var(--border)] last:border-b-0">
              <button
                onClick={() => toggleGroup(status)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-secondary)] transition-colors text-left"
              >
                {isCollapsed ? <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" /> : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
                <span className={`font-mono text-sm ${TASK_STATUS_COLOR[status]}`}>{TASK_STATUS_ICON[status]}</span>
                <span className="text-xs text-[var(--text-secondary)] capitalize">{status}</span>
                <span className="ml-auto text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">{tasks.length}</span>
              </button>
              {!isCollapsed && tasks.length > 0 && (
                <div className="pb-1">
                  {tasks.map(task => (
                    <div key={task.id} style={{ height: '36px' }} className="flex items-center gap-2 px-4 hover:bg-[var(--bg-secondary)]/50 transition-colors">
                      <span className={`font-mono text-xs shrink-0 w-4 text-center ${TASK_STATUS_COLOR[status]}`}>{TASK_STATUS_ICON[status]}</span>
                      <span className="text-xs text-[var(--text-secondary)] truncate">{task.agent}</span>
                      {task.task && <span className="text-[10px] text-[var(--text-muted)] truncate flex-1">{task.task.slice(0, 40)}</span>}
                    </div>
                  ))}
                </div>
              )}
              {!isCollapsed && tasks.length === 0 && (
                <div style={{ height: '36px' }} className="flex items-center px-4">
                  <span className="text-[10px] text-[var(--text-muted)] opacity-50">empty</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Agent Run History Panel ──────────────────────────────────────────────────

const RUN_STATUS_COLOR: Record<string, string> = {
  running: 'bg-[var(--success)]',
  done: 'bg-[var(--text-muted)]',
  failed: 'bg-[var(--error)]',
  pending: 'bg-amber-400',
  claimed: 'bg-blue-400',
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - Date.parse(isoString)
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

interface AgentRunHistoryPanelProps {
  zoneTopRef: React.RefObject<HTMLDivElement | null>
}

function AgentRunHistoryPanel({ zoneTopRef }: AgentRunHistoryPanelProps) {
  const [filterAgent, setFilterAgent] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterProject, setFilterProject] = useState('all')
  const [showJumpToLive, setShowJumpToLive] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  const { data: runsData, error } = useAgentRuns({ limit: 100 })

  // IntersectionObserver to show/hide "Jump to live" button
  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setShowJumpToLive(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  const allRuns = runsData?.runs ?? []

  const projects = useMemo(() => {
    const unique = [...new Set(allRuns.map(r => r.project).filter(Boolean))] as string[]
    return unique.sort()
  }, [allRuns])

  const filteredRuns = useMemo(() => {
    return allRuns.filter(r => {
      if (filterAgent && !r.agent.toLowerCase().includes(filterAgent.toLowerCase())) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterProject !== 'all' && r.project !== filterProject) return false
      return true
    })
  }, [allRuns, filterAgent, filterStatus, filterProject])

  const longestDuration = useMemo(() => {
    let max = 0
    for (const r of filteredRuns) {
      if (r.ended_at) {
        const d = Date.parse(r.ended_at) - Date.parse(r.started_at)
        if (d > max) max = d
      }
    }
    return max
  }, [filteredRuns])

  const handleJumpToLive = () => {
    if (zoneTopRef.current) {
      zoneTopRef.current.scrollIntoView({ behavior: 'smooth' })
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden border-t border-[var(--border)]">
      {/* Header + filter bar */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Agent Run History</h3>
          <span className="text-[10px] text-[var(--text-muted)]">{filteredRuns.length} runs</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Filter agent..."
            value={filterAgent}
            onChange={e => setFilterAgent(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/40 w-32"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/40"
          >
            <option value="all">All status</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>
          {projects.length > 0 && (
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]/40 max-w-[140px]"
            >
              <option value="all">All projects</option>
              {projects.map(p => <option key={p} value={p}>{p.split('/').pop()}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Run list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div ref={topSentinelRef} className="h-px" />
        {error ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[var(--text-muted)]">Failed to load run history</span>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-xs text-[var(--text-muted)]">No runs match the current filters</span>
          </div>
        ) : (
          filteredRuns.map(run => {
            const duration = run.ended_at ? Date.parse(run.ended_at) - Date.parse(run.started_at) : 0
            const barWidth = longestDuration > 0 ? Math.max(2, Math.round((duration / longestDuration) * 100)) : 0
            const statusColor = RUN_STATUS_COLOR[run.status] ?? 'bg-[var(--text-muted)]'
            return (
              <div key={run.id} className="flex items-center gap-3 px-4 py-1.5 hover:bg-[var(--bg-secondary)]/50 border-b border-[var(--border)]/30 last:border-b-0">
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${statusColor}`} />
                <span className="text-xs font-mono text-cyan-400 whitespace-nowrap shrink-0 min-w-[80px]">{run.agent}</span>
                <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap shrink-0">{relativeTime(run.started_at)}</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1 rounded-full bg-[var(--bg-secondary)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusColor} opacity-60`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                {run.cost_usd > 0 && (
                  <span className="text-[10px] text-purple-400 whitespace-nowrap shrink-0">${run.cost_usd.toFixed(3)}</span>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Jump to live sticky button */}
      {showJumpToLive && (
        <button
          onClick={handleJumpToLive}
          className="absolute bottom-4 right-4 text-xs px-3 py-1.5 rounded-full bg-[var(--accent)] text-[#070A0F] font-semibold shadow-lg hover:opacity-90 transition-opacity z-10"
        >
          Jump to live
        </button>
      )}
    </div>
  )
}

// ─── Session Log SSE types ────────────────────────────────────────────────────

interface SessionLogEvent {
  timestamp: string
  tool_name: string | null
  agent: string | null
  event_type: string
  connected?: boolean
}

const EVENT_TYPE_COLOR: Record<string, string> = {
  tool_use: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  assistant: 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30',
  user: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  agent_spawned: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  routing_event: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  unknown: 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]',
}

function eventTypeChipClass(eventType: string): string {
  return EVENT_TYPE_COLOR[eventType] ?? EVENT_TYPE_COLOR.unknown
}

function formatLogTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return iso
  }
}

// ─── Session Log Panel ────────────────────────────────────────────────────────

const MAX_RETRIES = 5
const BASE_RETRY_DELAY_MS = 1000

function SessionLogPanel() {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<SessionLogEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [paused, setPaused] = useState(false)
  const [connectionLost, setConnectionLost] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = useRef<EventSource | null>(null)
  pausedRef.current = paused

  useEffect(() => {
    if (!open) return

    let cancelled = false

    function connect() {
      if (cancelled) return

      const es = new EventSource('/api/live/stream')
      esRef.current = es

      es.onmessage = (e: MessageEvent) => {
        // Successful message resets retry counter
        retryCountRef.current = 0
        setConnectionLost(false)

        try {
          const payload: SessionLogEvent = JSON.parse(e.data)
          if (payload.connected === false) {
            setConnected(false)
            return
          }
          setConnected(true)
          if (pausedRef.current) return
          setEvents(prev => [...prev, payload].slice(-200))
        } catch { /* ignore */ }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()

        if (cancelled) return

        const attempt = retryCountRef.current
        if (attempt >= MAX_RETRIES) {
          setConnectionLost(true)
          return
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
        retryCountRef.current = attempt + 1
        retryTimerRef.current = setTimeout(connect, delay)
      }

      return es
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
      esRef.current?.close()
      esRef.current = null
      setConnected(false)
      retryCountRef.current = 0
      setConnectionLost(false)
    }
  }, [open])

  // Auto-scroll to bottom when new events arrive (unless paused)
  useEffect(() => {
    if (paused) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [events, paused])

  return (
    <div
      className="flex flex-col border-t border-[var(--border)] overflow-hidden flex-shrink-0 transition-all"
      style={{ height: open ? '28vh' : '2.75rem' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="flex-shrink-0 flex items-center gap-1.5 px-4 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-2 text-left"
      >
        <span>{open ? '▾' : '▸'}</span>
        Session Log
        {open && (
          <span className={`ml-1 inline-flex h-1.5 w-1.5 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
        )}
        {open && events.length > 0 && (
          <span className="text-[10px] text-[var(--text-muted)] ml-1">({events.length})</span>
        )}
        {open && (
          <button
            onClick={e => { e.stopPropagation(); setPaused(v => !v) }}
            className="ml-auto text-[10px] px-2 py-0.5 rounded border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
      </button>

      {open && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 pb-2 space-y-0.5"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {events.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              {connectionLost ? (
                <span className="text-xs text-[var(--error)]">Connection lost — reload to retry</span>
              ) : connected ? (
                <span className="text-xs text-[var(--text-muted)]">Waiting for events...</span>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">No active session</span>
              )}
            </div>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-[10px] font-mono text-[var(--text-muted)] whitespace-nowrap shrink-0 w-[72px]">
                  {formatLogTime(ev.timestamp)}
                </span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${eventTypeChipClass(ev.event_type)}`}>
                  {ev.event_type}
                </span>
                {ev.tool_name && (
                  <span className="text-[10px] text-cyan-400 font-mono whitespace-nowrap shrink-0">
                    {ev.tool_name}
                  </span>
                )}
                {ev.agent && (
                  <span className="text-[10px] text-[var(--text-secondary)] truncate">
                    {ev.agent}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main LiveView ────────────────────────────────────────────────────────────

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [chains, setChains] = useState<ChainState[]>(loadChainHistory)
  const [rawOpen, setRawOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  // ── OS Activity Monitor data ──────────────────────────────────────────────
  const { data: castdStatus } = useCastdStatus()
  const { data: tokenSpend } = useTokenSpend()

  const todayCostUSD = useMemo(() => {
    if (!tokenSpend?.daily) return 0
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    return entry?.costUsd ?? 0
  }, [tokenSpend])

  const tokensPerHr = useMemo(() => {
    if (!tokenSpend?.daily) return 0
    const now = Date.now()
    const oneHourAgo = now - 3_600_000
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    if (!entry) return 0
    // Approximate: use today's total tokens as hourly rate proxy (no per-hour breakdown available)
    return entry.inputTokens + entry.outputTokens
  }, [tokenSpend])

  // Zone2-top ref for "Jump to live" anchor
  const zone2TopRef = useRef<HTMLDivElement>(null)
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
        id: `cmd-${event.commandId ?? event.timestamp}-${event.commandType ?? ''}`,
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
        id: `tool-${event.sessionId ?? 'x'}-${event.timestamp}-${event.toolName ?? ''}`,
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

  // Active agent count = chains with at least one running agent
  const activeAgentCount = useMemo(() => {
    return displayChains.filter(c => c.isActive && c.agents.some(a => a.status === 'running')).length
  }, [displayChains])

  const activeChains = displayChains.filter(c => c.isActive)
  const pastChains = displayChains.filter(c => !c.isActive)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Zone 1 — Vitals Row (pinned) */}
      <ActivityStatusBar
        daemonRunning={castdStatus?.running ?? false}
        queueDepth={castdStatus?.queueDepth ?? 0}
        activeAgents={activeAgentCount}
        sessionCostUSD={todayCostUSD}
        tokensPerHr={tokensPerHr}
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

      {/* Zone 2 — Split pane: Live Agents (left) + Task Queue (right) */}
      <div ref={zone2TopRef} className="flex-shrink-0 flex border-b border-[var(--border)]" style={{ height: '45vh' }}>
        {/* Left: Live Agents */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-[var(--border)]">
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Live Agents</h3>
            <div className="flex items-center gap-2">
              {pastChains.length > 0 && (
                <button
                  onClick={() => setHistoryOpen(v => !v)}
                  className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <Clock size={10} />
                  {historyOpen ? 'Hide' : `History (${pastChains.length})`}
                </button>
              )}
              {pastChains.length > 0 && (
                <button
                  onClick={() => {
                    localStorage.removeItem(CHAIN_HISTORY_KEY)
                    setChains(prev => prev.filter(c => Date.now() - c.lastModifiedMs < ACTIVE_WINDOW_MS))
                    toast.success('History cleared')
                  }}
                  className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                  title="Clear history"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeChains.length === 0 && !historyOpen ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Activity className="w-6 h-6 text-[var(--text-muted)] opacity-30" />
                <p className="text-xs text-[var(--text-muted)] opacity-60">No active sessions</p>
              </div>
            ) : (
              <>
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
                {historyOpen && pastChains.map(chain => (
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
              </>
            )}
          </div>
        </div>

        {/* Right: Task Queue */}
        <div className="flex flex-col w-64 shrink-0">
          <TaskQueuePanel />
        </div>
      </div>

      {/* Zone 3 — Agent Run History (independently scrollable) */}
      <div className="flex-1 min-h-0 relative">
        <AgentRunHistoryPanel zoneTopRef={zone2TopRef} />
      </div>

      {/* Raw event log — collapsed by default */}
      <div
        className="flex flex-col border-t border-[var(--border)] px-4 pt-2 pb-2 overflow-hidden flex-shrink-0 transition-all"
        style={{ height: rawOpen ? '30vh' : '2.75rem' }}
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

      {/* Session Log (SSE tail of ~/.claude/logs/*.jsonl) */}
      <SessionLogPanel />

    </div>
  )
}
