import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Clock, Trash2, Server, DollarSign, Cpu, ChevronDown, ChevronRight, Zap as SpawnIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveEvents } from '../api/useLive'
import { useCastdStatus } from '../api/useCastdControl'
import { useTokenSpend } from '../api/useTokenSpend'
import { useAgentRuns } from '../api/useAgentRuns'
import type { AgentRun } from '../api/useAgentRuns'
import type { LiveEvent, ContentBlock, LogEntry } from '../types'
import { type FeedItem, FeedCard } from '../components/FeedCard'
import DispatchChain from '../components/LiveView/DispatchChain'
import type { DispatchChainProps } from '../components/LiveView/DispatchChain'
import type { AgentCardProps, ToolEvent } from '../components/LiveView/AgentCard'
import type { AgentStatus } from '../components/LiveView/StatusPill'
import { useRoutingEventsByType } from '../api/useRoutingEventsByType'

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

// ─── Activity Status Bar ──────────────────────────────────────────────────────

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
  cronActive: boolean
  cronCount: number
  activeAgents: number
  sessionCostUSD: number
  tokensPerHr: number
}

function ActivityStatusBar({ cronActive, cronCount, activeAgents, sessionCostUSD, tokensPerHr }: ActivityStatusBarProps) {
  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)] overflow-x-auto">
      <VitalCard
        label="Active Agents"
        value={String(activeAgents)}
        status={activeAgents > 0 ? 'green' : 'neutral'}
        icon={Activity}
      />
      <VitalCard
        label="Cron Jobs"
        value={cronActive ? `${cronCount} active` : 'none'}
        status={cronActive ? 'green' : 'neutral'}
        icon={Server}
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
    </div>
  )
}

// ─── Chain grouping helpers ───────────────────────────────────────────────────

const CHAIN_PROXIMITY_MS = 60_000 // runs within 60s + same session_id = same chain

interface RunChain {
  chainId: string
  sessionId: string | null
  runs: AgentRun[]
  startedAt: string
  totalCostUsd: number
  elapsedMs: number | null
}

function groupRunsIntoChains(runs: AgentRun[]): RunChain[] {
  if (runs.length === 0) return []

  // Sort by started_at ascending for proximity grouping
  const sorted = [...runs].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )

  const chains: RunChain[] = []
  let current: AgentRun[] = []

  for (const run of sorted) {
    if (current.length === 0) {
      current = [run]
      continue
    }

    const prev = current[current.length - 1]
    const sameSession = run.session_id === prev.session_id
    const closeInTime =
      new Date(run.started_at).getTime() - new Date(prev.started_at).getTime() < CHAIN_PROXIMITY_MS

    if (sameSession && closeInTime) {
      current.push(run)
    } else {
      chains.push(buildChain(current))
      current = [run]
    }
  }
  if (current.length > 0) chains.push(buildChain(current))

  // Return newest first
  return chains.reverse()
}

function buildChain(runs: AgentRun[]): RunChain {
  const first = runs[0]
  const last = runs[runs.length - 1]
  const startMs = new Date(first.started_at).getTime()
  const endMs = last.ended_at ? new Date(last.ended_at).getTime() : null
  const totalCostUsd = runs.reduce((s, r) => s + (r.cost_usd ?? 0), 0)
  const chainId = first.agent_id
    ? String(first.agent_id).slice(0, 8)
    : String(first.id)

  return {
    chainId,
    sessionId: first.session_id,
    runs,
    startedAt: first.started_at,
    totalCostUsd,
    elapsedMs: endMs ? endMs - startMs : null,
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - Date.parse(isoString)
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ─── ModelBadge ───────────────────────────────────────────────────────────────

function ModelBadge({ model }: { model?: string | null }) {
  if (!model) return <span className="text-[var(--text-muted)] text-xs">—</span>
  const lower = model.toLowerCase()
  const label = lower.includes('opus') ? 'Opus'
    : lower.includes('haiku') ? 'Haiku'
    : lower.includes('sonnet') ? 'Sonnet'
    : model
  const color = lower.includes('opus')
    ? 'bg-purple-500/20 text-purple-300'
    : lower.includes('haiku')
    ? 'bg-blue-500/20 text-blue-300'
    : lower.includes('sonnet')
    ? 'bg-emerald-500/20 text-emerald-300'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type RunStatus = 'running' | 'done' | 'done_with_concerns' | 'failed' | 'blocked' | 'needs_context' | string

function StatusBadge({ status }: { status: RunStatus }) {
  const normalized = (status ?? '').toLowerCase().replace(/ /g, '_')
  const cfg: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    running:            { label: 'RUNNING',           cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30', pulse: true },
    done:               { label: 'DONE',              cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
    done_with_concerns: { label: 'CONCERNS',          cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
    failed:             { label: 'FAILED',            cls: 'bg-red-500/20 text-red-300 border border-red-500/30' },
    blocked:            { label: 'BLOCKED',           cls: 'bg-red-500/20 text-red-300 border border-red-500/30' },
    needs_context:      { label: 'NEEDS CTX',         cls: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  }
  const { label, cls, pulse } = cfg[normalized] ?? { label: status?.toUpperCase() ?? '?', cls: 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cls}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {label}
    </span>
  )
}

// ─── Agent run card ───────────────────────────────────────────────────────────

function AgentRunCard({ run }: { run: AgentRun }) {
  const normalized = (run.status ?? '').toLowerCase().replace(/ /g, '_')
  const isRunning = normalized === 'running'
  const isConcerns = normalized === 'done_with_concerns'
  const isError = normalized === 'failed' || normalized === 'blocked'

  const durationMs = run.ended_at
    ? new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
    : isRunning
    ? Date.now() - new Date(run.started_at).getTime()
    : null

  const borderCls = isRunning
    ? 'border-l-2 border-l-blue-500 animate-pulse'
    : isConcerns
    ? 'border-l-2 border-l-amber-500'
    : isError
    ? 'border-l-2 border-l-red-500'
    : 'border-l-2 border-l-transparent'

  const bgCls = isConcerns
    ? 'bg-amber-500/5'
    : isError
    ? 'bg-red-500/5'
    : 'bg-[var(--bg-secondary)]'

  return (
    <div className={`flex items-start gap-3 px-3 py-2 rounded-lg border border-[var(--glass-border)] ${bgCls} ${borderCls}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-cyan-400 whitespace-nowrap">{run.agent}</span>
          <ModelBadge model={run.model} />
          <StatusBadge status={run.status} />
          {durationMs !== null && (
            <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap ml-auto">
              {formatDuration(durationMs)}
            </span>
          )}
          {run.cost_usd > 0 && (
            <span className="text-[10px] text-purple-400 whitespace-nowrap font-mono">
              ${run.cost_usd.toFixed(4)}
            </span>
          )}
        </div>
        {run.task_summary && (
          <p className="text-[11px] text-[var(--text-muted)] truncate leading-relaxed">
            {run.task_summary.slice(0, 120)}
          </p>
        )}
        <div className="text-[10px] text-[var(--text-muted)] opacity-60">{relativeTime(run.started_at)}</div>
      </div>
    </div>
  )
}

// ─── Chain card ───────────────────────────────────────────────────────────────

interface ChainCardProps {
  chain: RunChain
  defaultExpanded: boolean
}

function ChainCard({ chain, defaultExpanded }: ChainCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const hasRunning = chain.runs.some(r => r.status.toLowerCase() === 'running')
  const hasFailed = chain.runs.some(r => ['failed', 'blocked'].includes(r.status.toLowerCase()))

  const headerCls = hasRunning
    ? 'text-blue-300'
    : hasFailed
    ? 'text-red-300'
    : 'text-[var(--text-secondary)]'

  return (
    <div className="rounded-lg border border-[var(--glass-border)] overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        }
        <span className={`text-xs font-mono font-semibold ${headerCls}`}>
          {chain.chainId}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
          {chain.runs.length} agent{chain.runs.length !== 1 ? 's' : ''}
        </span>
        {chain.totalCostUsd > 0 && (
          <span className="text-[10px] text-purple-400 font-mono whitespace-nowrap">
            ${chain.totalCostUsd.toFixed(4)}
          </span>
        )}
        {chain.elapsedMs !== null && (
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap ml-auto">
            {formatDuration(chain.elapsedMs)}
          </span>
        )}
        {hasRunning && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-blue-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            live
          </span>
        )}
      </button>
      {expanded && (
        <div className="p-2 space-y-1.5 bg-[var(--bg-primary)]">
          {chain.runs.map(run => (
            <AgentRunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

type FeedFilter = 'all' | 'running' | 'done' | 'concerns' | 'failed'

const FILTER_LABELS: Record<FeedFilter, string> = {
  all: 'All',
  running: 'Running',
  done: 'Done',
  concerns: 'Concerns',
  failed: 'Failed',
}

function FilterPills({ active, onChange }: { active: FeedFilter; onChange: (f: FeedFilter) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(Object.keys(FILTER_LABELS) as FeedFilter[]).map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            active === f
              ? 'bg-[var(--accent)] text-[#070A0F]'
              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--glass-border)]'
          }`}
        >
          {FILTER_LABELS[f]}
        </button>
      ))}
    </div>
  )
}

function matchesFilter(run: AgentRun, filter: FeedFilter): boolean {
  if (filter === 'all') return true
  const s = run.status.toLowerCase().replace(/ /g, '_')
  if (filter === 'running') return s === 'running'
  if (filter === 'done') return s === 'done'
  if (filter === 'concerns') return s === 'done_with_concerns'
  if (filter === 'failed') return s === 'failed' || s === 'blocked'
  return true
}

// ─── Main Feed Panel (65%) ────────────────────────────────────────────────────

interface MainFeedProps {
  chains: ChainState[]
  connected: boolean
  historyOpen: boolean
  onToggleHistory: () => void
  onClearHistory: () => void
}

function MainFeed({ chains, connected, historyOpen, onToggleHistory, onClearHistory }: MainFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>('all')

  const refetchInterval = filter === 'running' ? 3_000 : 15_000
  const { data: runsData } = useAgentRuns({ limit: 200, refetchInterval })

  const allRuns = runsData?.runs ?? []

  const filteredRuns = useMemo(() => {
    return allRuns.filter(r => matchesFilter(r, filter))
  }, [allRuns, filter])

  const chains_ = useMemo(() => groupRunsIntoChains(filteredRuns), [filteredRuns])

  // Default: expand the 3 most recent chains
  const expandedDefault = useMemo(() => {
    const ids = new Set<string>()
    chains_.slice(0, 3).forEach(c => ids.add(c.chainId))
    return ids
  }, [chains_])

  const activeChains = chains.filter(c => c.isActive)
  const pastChains = chains.filter(c => !c.isActive)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--border)] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Agent Feed</h2>
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full ${connected ? 'bg-[var(--success)] animate-ping' : 'bg-[var(--error)]'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
            </span>
            <span className="text-xs text-[var(--text-muted)]">{connected ? 'Streaming' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2">
            {pastChains.length > 0 && (
              <button
                onClick={onToggleHistory}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Clock size={10} />
                {historyOpen ? 'Hide SSE history' : `SSE history (${pastChains.length})`}
              </button>
            )}
            {pastChains.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                title="Clear history"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>
        <FilterPills active={filter} onChange={setFilter} />
      </div>

      {/* SSE live chains (top) */}
      {(activeChains.length > 0 || (historyOpen && pastChains.length > 0)) && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)] space-y-1.5">
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide px-1 mb-1">Live SSE Chains</div>
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
        </div>
      )}

      {/* DB-sourced chain groups */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {chains_.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <Activity className="w-6 h-6 text-[var(--text-muted)] opacity-30" />
            <p className="text-xs text-[var(--text-muted)] opacity-60">
              {filter === 'all' ? 'No agent runs yet' : `No ${FILTER_LABELS[filter].toLowerCase()} runs`}
            </p>
          </div>
        ) : (
          chains_.map(chain => (
            <ChainCard
              key={chain.chainId}
              chain={chain}
              defaultExpanded={expandedDefault.has(chain.chainId)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Right Sidebar (35%) ──────────────────────────────────────────────────────

const CHAIN_HISTORY_KEY = 'cast-chain-history'

interface RightSidebarProps {
  pastChains: ChainState[]
}

function RightSidebar({ pastChains }: RightSidebarProps) {
  const { data: runsData } = useAgentRuns({ status: 'running', refetchInterval: 3_000 })
  const runningRuns = runsData?.runs?.filter(r => r.status.toLowerCase() === 'running') ?? []

  const { data: spawnEvents } = useRoutingEventsByType('task_claimed', 50)

  const [expandedChain, setExpandedChain] = useState<string | null>(null)

  // Last 10 chains from SSE history
  const recentChains = useMemo(() => {
    return [...pastChains]
      .sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)
      .slice(0, 10)
  }, [pastChains])

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-[var(--border)]">
      {/* Active Right Now */}
      <div className="flex-shrink-0 border-b border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Active Right Now</h3>
        </div>
        <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
          {runningRuns.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2 text-center">No agents running</p>
          ) : (
            runningRuns.map(run => (
              <div key={run.id} className="flex items-center gap-2 py-1 border-l-2 border-l-blue-500 pl-2 animate-pulse">
                <Link
                  to={`/agents/${run.agent}`}
                  className="text-xs font-mono text-cyan-400 truncate flex-1 hover:underline hover:text-cyan-300 cursor-pointer"
                >
                  {run.agent}
                </Link>
                <ModelBadge model={run.model} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Agent Spawns */}
      <div className="flex-shrink-0 border-b border-[var(--border)]">
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-1.5">
          <SpawnIcon className="w-3 h-3 text-[var(--text-muted)]" />
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Agent Spawns</h3>
        </div>
        <div className="px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
          {!spawnEvents || spawnEvents.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2 text-center">No spawn events yet</p>
          ) : (
            spawnEvents.map(ev => {
              let agentName = 'unknown'
              try {
                const parsed = ev.data ? JSON.parse(ev.data) : null
                agentName = parsed?.agent ?? ev.agent ?? 'unknown'
              } catch {
                agentName = ev.agent ?? 'unknown'
              }
              return (
                <div key={ev.id} className="flex items-center gap-2 py-0.5 text-xs">
                  <span className="font-mono text-cyan-400 truncate flex-1">{agentName}</span>
                  <span className="text-[var(--text-muted)] font-mono shrink-0">{ev.session_id.slice(0, 8)}</span>
                  <span className="text-[var(--text-muted)] shrink-0 whitespace-nowrap">{relativeTime(ev.timestamp)}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Recent Chains */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Recent Chains</h3>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {recentChains.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2 text-center opacity-60">No chain history</p>
          ) : (
            recentChains.map(chain => {
              const isExpanded = expandedChain === chain.sessionId
              const runningAgent = chain.agents.find(a => a.status === 'running')
              return (
                <div key={chain.sessionId} className="rounded border border-[var(--glass-border)] overflow-hidden">
                  <button
                    onClick={() => setExpandedChain(isExpanded ? null : chain.sessionId)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    }
                    <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 whitespace-nowrap">
                      {relativeTime(chain.startedAt)}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                      {chain.promptPreview?.slice(0, 50) ?? chain.sessionId.slice(0, 8)}
                    </span>
                    {runningAgent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-2 py-2 bg-[var(--bg-primary)] space-y-1">
                      {chain.agents.map((agent, i) => (
                        <div key={agent.agentId ?? i} className="flex items-center gap-2 text-xs">
                          <StatusBadge status={agent.status} />
                          <span className="font-mono text-cyan-400 truncate">{agent.agentName}</span>
                          {agent.model && <ModelBadge model={agent.model} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chain state persistence ──────────────────────────────────────────────────

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

// ─── Main LiveView ────────────────────────────────────────────────────────────

const ACTIVE_WINDOW_MS = 2 * 60 * 1000

export default function LiveView() {
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [chains, setChains] = useState<ChainState[]>(loadChainHistory)
  const [rawOpen, setRawOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

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
    const today = new Date().toISOString().slice(0, 10)
    const entry = tokenSpend.daily.find(d => d.date === today)
    if (!entry) return 0
    return entry.inputTokens + entry.outputTokens
  }, [tokenSpend])

  // Take over main's scroll so internal panes can own scroll independently
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

  // 30s ticker to mark stale agents
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

  const chainsRef = useRef<ChainState[]>([])
  chainsRef.current = chains

  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type === 'heartbeat') return

    const now = Date.now()

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

    const feedItem = eventToFeedItem(event)
    if (feedItem) {
      setFeed(prev => [feedItem, ...prev].slice(0, 50))
    }

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
          if (found) {
            return { ...c, agents: updatedAgents }
          }
          return c
        }

        const runningAgents = c.agents
          .map((a, idx) => ({ a, idx }))
          .filter(({ a }) => a.status === 'running')
        if (runningAgents.length === 0) return c

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

    if (event.type === 'session_complete') {
      const completedStatus = (event.status ?? 'DONE') as AgentStatus
      setChains(prev => prev.map(c => {
        if (c.sessionId !== sessionId) return c

        if (event.subagentId) {
          const { agents: updatedAgents, found } = updateAgentById(c.agents, event.subagentId, a => {
            if (a.status !== 'running' && a.status !== 'stale') return a
            return { ...a, status: completedStatus, completedAt: event.timestamp, currentActivity: undefined }
          })
          if (found) {
            return { ...c, agents: updatedAgents }
          }
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
      return
    }

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
              isSubagent: existing?.isSubagent,
              parentAgentId: existing?.parentAgentId,
              agentDescription: existing?.agentDescription,
              toolEvents: existing?.toolEvents,
              subAgents: existing?.subAgents,
            })
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
  }, [ACTIVE_WINDOW_MS])

  const { connected } = useLiveEvents(handleEvent)

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
    .filter((c, _, arr) => {
      if (c.isActive) return true
      const pastIdx = arr.filter(x => !x.isActive).indexOf(c)
      return pastIdx < 25
    })

  const activeAgentCount = useMemo(() => {
    return displayChains.filter(c => c.isActive && c.agents.some(a => a.status === 'running')).length
  }, [displayChains])

  const pastChains = displayChains.filter(c => !c.isActive)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Status Bar */}
      <ActivityStatusBar
        cronActive={castdStatus?.running ?? false}
        cronCount={castdStatus?.count ?? 0}
        activeAgents={activeAgentCount}
        sessionCostUSD={todayCostUSD}
        tokensPerHr={tokensPerHr}
      />

      {/* Main layout: 65% feed + 35% sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Main Feed — 65% */}
        <div className="flex flex-col flex-1 min-w-0" style={{ flexBasis: '65%', maxWidth: '65%' }}>
          <MainFeed
            chains={displayChains}
            connected={connected}
            historyOpen={historyOpen}
            onToggleHistory={() => setHistoryOpen(v => !v)}
            onClearHistory={() => {
              localStorage.removeItem(CHAIN_HISTORY_KEY)
              setChains(prev => prev.filter(c => Date.now() - c.lastModifiedMs < ACTIVE_WINDOW_MS))
              toast.success('History cleared')
            }}
          />
        </div>

        {/* Right Sidebar — 35% */}
        <div className="flex-shrink-0" style={{ flexBasis: '35%', width: '35%' }}>
          <RightSidebar pastChains={pastChains} />
        </div>
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

    </div>
  )
}
