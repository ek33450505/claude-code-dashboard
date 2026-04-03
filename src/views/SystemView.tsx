import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Route, Send, Clock, RefreshCw,
  Play, Trash2, Plus, Check, ChevronDown, ChevronRight
} from 'lucide-react'
import { useState, lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgents, useAgent } from '../api/useAgents'
import { useSystemHealth } from '../api/useSystem'
import { useRules, useSkills, useCommands } from '../api/useKnowledge'
import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import { usePlans, usePlan } from '../api/usePlans'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

const HookHealthView = lazy(() => import('./HookHealthView'))
const SqliteExplorerView = lazy(() => import('./SqliteExplorerView'))

// ── Tab types ──────────────────────────────────────────────────────────────

type SystemTab = 'agents' | 'rules' | 'skills' | 'hooks' | 'memory' | 'plans' | 'db' | 'cron'

const SYSTEM_TABS: { key: SystemTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'agents',  label: 'Agents',   icon: Users },
  { key: 'rules',   label: 'Rules',    icon: Shield },
  { key: 'skills',  label: 'Skills',   icon: Zap },
  { key: 'hooks',   label: 'Hooks',    icon: Route },
  { key: 'memory',  label: 'Memory',   icon: Brain },
  { key: 'plans',   label: 'Plans',    icon: FileText },
  { key: 'db',      label: 'DB',       icon: Database },
  { key: 'cron',    label: 'Cron',     icon: Clock },
]

// ── Agents Tab ─────────────────────────────────────────────────────────────

function AgentDetailInline({ name }: { name: string }) {
  const { data, isLoading } = useAgent(name)
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-xs space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-[var(--text-primary)]">{data.name}</span>
        <span className="text-[var(--text-muted)]">{data.model}</span>
        {data.color && (
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        )}
      </div>
      <p className="text-[var(--text-secondary)]">{data.description}</p>
      {data.body && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[var(--accent)] hover:underline">View full definition</summary>
          <pre className="mt-2 p-3 bg-[var(--bg-primary)] rounded text-[10px] overflow-x-auto whitespace-pre-wrap max-h-80">
            {data.body}
          </pre>
        </details>
      )}
    </div>
  )
}

function AgentsTab() {
  const { data: agents, isLoading } = useAgents()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading agents...</div>
  if (!agents || agents.length === 0) return <div className="p-6 text-[var(--text-muted)]">No agents found.</div>

  return (
    <div className="space-y-1">
      {agents.map(agent => (
        <div key={agent.name} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === agent.name ? null : agent.name)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === agent.name
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <span className="font-medium text-sm text-[var(--text-primary)]">{agent.name}</span>
            <span className="text-xs text-[var(--text-muted)] ml-auto">{agent.model}</span>
          </button>
          {expanded === agent.name && <AgentDetailInline name={agent.name} />}
        </div>
      ))}
    </div>
  )
}

// ── Rules Tab ──────────────────────────────────────────────────────────────

function RulesTab() {
  const { data: rules, isLoading } = useRules()
  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading rules...</div>
  if (!rules || rules.length === 0) return <div className="p-6 text-[var(--text-muted)]">No rules found.</div>

  return (
    <div className="space-y-2">
      {rules.map(rule => (
        <div key={rule.filename} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-[var(--text-primary)]">{rule.filename}</span>
            <span className="text-xs text-[var(--text-muted)]">{new Date(rule.modifiedAt).toLocaleDateString()}</span>
          </div>
          {rule.preview && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{rule.preview}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Skills & Commands Tab ──────────────────────────────────────────────────

function SkillsTab() {
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[var(--accent)]" />
          Skills ({skills?.length ?? 0})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(skills ?? []).map(s => (
            <span
              key={s.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
              title={s.description}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[var(--accent)]" />
          Commands ({commands?.length ?? 0})
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {(commands ?? []).map(c => (
            <span
              key={c.name}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
            >
              /{c.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Memory Tab ─────────────────────────────────────────────────────────────

function MemoryTab() {
  const { data: agentMem, isLoading: loadingAgent } = useAgentMemory()
  const { data: projectMem, isLoading: loadingProject } = useProjectMemory()

  if (loadingAgent || loadingProject) return <div className="p-6 text-[var(--text-muted)]">Loading memory...</div>

  const allMemories = [
    ...(agentMem ?? []).map(m => ({ ...m, source: 'agent' as const })),
    ...(projectMem ?? []).map(m => ({ ...m, source: 'project' as const })),
  ]

  if (allMemories.length === 0) return <div className="p-6 text-[var(--text-muted)]">No memory files found in agent-memory-local/.</div>

  return (
    <div className="space-y-2">
      {allMemories.map((mem, i) => (
        <div key={i} className="border border-[var(--border)] rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Brain className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="font-mono text-sm text-[var(--text-primary)]">{mem.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              {mem.source}
            </span>
          </div>
          {mem.description && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 ml-7">{mem.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Plans Tab ──────────────────────────────────────────────────────────────

function PlanDetailInline({ filename }: { filename: string }) {
  const { data, isLoading } = usePlan(filename)
  if (isLoading) return <div className="p-4 text-xs text-[var(--text-muted)]">Loading...</div>
  if (!data) return null
  return (
    <pre className="p-4 bg-[var(--bg-tertiary)] rounded-lg text-[10px] overflow-x-auto whitespace-pre-wrap max-h-96">
      {data.body}
    </pre>
  )
}

function PlansTab() {
  const { data: plans, isLoading } = usePlans()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading plans...</div>
  if (!plans || plans.length === 0) return <div className="p-6 text-[var(--text-muted)]">No plans found.</div>

  return (
    <div className="space-y-1">
      {plans.map(plan => (
        <div key={plan.filename} className="border border-[var(--border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === plan.filename ? null : plan.filename)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {expanded === plan.filename
              ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm text-[var(--text-primary)] block truncate">{plan.title || plan.filename}</span>
              {plan.date && <span className="text-xs text-[var(--text-muted)]">{plan.date}</span>}
            </div>
          </button>
          {expanded === plan.filename && <PlanDetailInline filename={plan.filename} />}
        </div>
      ))}
    </div>
  )
}

// ── Cron Tab ───────────────────────────────────────────────────────────────

interface CronStatus {
  entries: string[]
  count: number
  error?: string
}

function isValidCronSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5
}

function extractCronCommand(line: string): string {
  const parts = line.trim().split(/\s+/)
  return parts.slice(5).join(' ')
}

function CronTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<CronStatus>({
    queryKey: ['castd', 'status'],
    queryFn: async () => {
      const res = await fetch('/api/castd/status')
      if (!res.ok) throw new Error('Failed to fetch cron status')
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const [adding, setAdding] = useState(false)
  const [newSchedule, setNewSchedule] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ entry: string; ok: boolean; msg: string } | null>(null)

  async function addEntry() {
    if (!newSchedule.trim() || !newCommand.trim()) return
    const res = await fetch('/api/castd/cron', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule: newSchedule.trim(), command: newCommand.trim() }),
    })
    if (res.ok) {
      setNewSchedule('')
      setNewCommand('')
      setAdding(false)
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    }
  }

  async function deleteEntry(entry: string) {
    if (!window.confirm(`Delete cron entry?\n\n${entry}`)) return
    setDeleting(entry)
    try {
      await fetch('/api/castd/cron', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      })
      queryClient.invalidateQueries({ queryKey: ['castd', 'status'] })
    } finally {
      setDeleting(null)
    }
  }

  async function triggerEntry(entry: string) {
    const command = extractCronCommand(entry)
    setTriggering(entry)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/castd/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const body = await res.json() as { ok?: boolean; stdout?: string; stderr?: string; error?: string }
      setTriggerResult({
        entry,
        ok: res.ok,
        msg: res.ok ? (body.stdout?.trim() || 'Done') : (body.error ?? `HTTP ${res.status}`),
      })
    } finally {
      setTriggering(null)
    }
  }

  const scheduleValid = isValidCronSchedule(newSchedule)

  if (isLoading) return <div className="p-6 text-[var(--text-muted)]">Loading cron status...</div>

  return (
    <div className="space-y-4">
      {data?.error && <p className="text-xs text-[var(--error)]">{data.error}</p>}

      {data?.count === 0 && !adding && (
        <p className="text-sm text-[var(--text-muted)]">No CAST cron entries found.</p>
      )}

      {(data?.entries ?? []).length > 0 && (
        <ul className="space-y-2">
          {data!.entries.map((entry, i) => (
            <li
              key={i}
              className="flex items-start gap-2 font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-lg px-3 py-2"
            >
              <span className="flex-1 break-all">{entry}</span>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  onClick={() => triggerEntry(entry)}
                  disabled={triggering === entry}
                  title="Run now"
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                >
                  <Play className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteEntry(entry)}
                  disabled={deleting === entry}
                  title="Delete entry"
                  className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {triggerResult && (
        <p
          className={`text-xs font-mono px-2 py-1 rounded ${triggerResult.ok ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-[var(--error)] bg-[var(--error)]/10'}`}
          role="status"
        >
          {triggerResult.ok ? 'OK' : 'FAIL'} {triggerResult.msg.slice(0, 120)}
        </p>
      )}

      {adding ? (
        <div className="space-y-2 pt-2 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <div className="space-y-1 flex-shrink-0 w-44">
              <label htmlFor="cron-schedule" className="block text-xs text-[var(--text-muted)]">Schedule (5 fields)</label>
              <input
                id="cron-schedule"
                type="text"
                value={newSchedule}
                onChange={e => setNewSchedule(e.target.value)}
                placeholder="0 * * * *"
                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-tertiary)] border ${scheduleValid || !newSchedule ? 'border-[var(--border)]' : 'border-rose-400'} text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]`}
              />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <label htmlFor="cron-command" className="block text-xs text-[var(--text-muted)]">Command</label>
              <input
                id="cron-command"
                type="text"
                value={newCommand}
                onChange={e => setNewCommand(e.target.value)}
                placeholder="cast exec --sweep"
                className="w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addEntry}
              disabled={!scheduleValid || !newCommand.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[#070A0F] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => { setAdding(false); setNewSchedule(''); setNewCommand('') }}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add cron entry
        </button>
      )}
    </div>
  )
}

// ── Dispatch Panel ─────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet 4.6' },
  { value: 'haiku',  label: 'Haiku 4.5' },
  { value: 'opus',   label: 'Opus 4.6' },
] as const

type DispatchResult =
  | { kind: 'success'; id: string }
  | { kind: 'error'; message: string }

function DispatchAgentPanel() {
  const [agentType, setAgentType] = useState('')
  const [taskText, setTaskText] = useState('')
  const [model, setModel] = useState<'sonnet' | 'haiku' | 'opus'>('sonnet')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const { data: agentsData, isLoading: agentsLoading } = useAgents()
  const agentNames = agentsData ? agentsData.map(a => a.name).sort() : []

  const canSubmit = agentType !== '' && taskText.trim() !== '' && !loading

  async function handleDispatch() {
    if (!canSubmit) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/control/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, prompt: taskText.trim(), model }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` })
      } else {
        const body = await res.json() as { id: string }
        setResult({ kind: 'success', id: body.id })
        setTaskText('')
      }
    } catch (err) {
      setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  const selectBase =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary,var(--bg-secondary))] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors'

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-[var(--accent)]" />
        <h3 className="text-sm font-semibold">Dispatch Agent</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1.5">
          <label htmlFor="dispatch-agent" className="block text-xs font-medium text-[var(--text-secondary)]">Agent</label>
          <select id="dispatch-agent" value={agentType} onChange={e => { setAgentType(e.target.value); setResult(null) }} className={selectBase} disabled={agentsLoading}>
            {agentsLoading ? <option value="" disabled>Loading...</option> : <option value="" disabled>Select agent...</option>}
            {agentNames.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="dispatch-model" className="block text-xs font-medium text-[var(--text-secondary)]">Model</label>
          <select id="dispatch-model" value={model} onChange={e => setModel(e.target.value as typeof model)} className={selectBase}>
            {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
      <textarea
        value={taskText}
        onChange={e => { setTaskText(e.target.value); setResult(null) }}
        placeholder="Describe the task..."
        rows={3}
        className={`${selectBase} resize-y min-h-[80px]`}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={handleDispatch}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" />
          {loading ? 'Dispatching...' : 'Dispatch'}
        </button>
        {result?.kind === 'success' && <p className="text-xs text-[var(--success)]" role="status">Dispatched: {String(result.id).slice(0, 8)}</p>}
        {result?.kind === 'error' && <p className="text-xs text-[var(--error)]" role="alert">{result.message}</p>}
      </div>
    </div>
  )
}

// ── Main SystemView ────────────────────────────────────────────────────────

export default function SystemView() {
  const [activeTab, setActiveTab] = useState<SystemTab>('agents')
  const { data: health, isLoading } = useSystemHealth()

  const statCards = health
    ? [
        { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
        { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
        { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
        { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">System</h1>

      {/* Stat cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map(stat => <StatCard key={stat.label} {...stat} />)}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
        {SYSTEM_TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'agents' && <AgentsTab />}
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'skills' && <SkillsTab />}
        {activeTab === 'hooks' && (
          <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading...</div>}>
            <HookHealthView />
          </Suspense>
        )}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'plans' && <PlansTab />}
        {activeTab === 'db' && (
          <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading...</div>}>
            <SqliteExplorerView />
          </Suspense>
        )}
        {activeTab === 'cron' && <CronTab />}
      </div>

      {/* Dispatch Agent panel — always visible at bottom */}
      <div className="mt-8">
        <DispatchAgentPanel />
      </div>
    </div>
  )
}
