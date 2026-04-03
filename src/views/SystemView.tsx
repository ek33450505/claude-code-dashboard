import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Route, Send, Clock, RefreshCw,
  Play, Trash2, Plus, Check
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState, lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAgents } from '../api/useAgents'
import { useSystemHealth } from '../api/useSystem'
import { useSkills, useCommands } from '../api/useKnowledge'
import { useRoutingStats } from '../api/useRouting'
import { useOutputs } from '../api/useOutputs'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

const HookHealthView = lazy(() => import('./HookHealthView'))
const PrivacyView = lazy(() => import('./PrivacyView'))
const SqliteExplorerView = lazy(() => import('./SqliteExplorerView'))

function maskValue(key: string, val: string): string {
  return /key|token|secret|password|auth|credential/i.test(key) ? '••••••••' : val
}

interface CronStatus {
  entries: string[]
  count: number
  error?: string
}

/** Extract the command portion from a full cron line (everything after 5 schedule fields) */
function extractCronCommand(line: string): string {
  const parts = line.trim().split(/\s+/)
  // First 5 parts are the cron schedule fields
  return parts.slice(5).join(' ')
}

/** Validate that a cron schedule expression has exactly 5 space-separated fields */
function isValidCronSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5
}

function CronSection() {
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

  return (
    <section className="mb-8">
      <details className="group" id="cron-section">
        <summary className="flex items-center justify-between cursor-pointer list-none mb-3 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none rounded-lg">
          <h2 className="text-lg font-semibold flex items-center gap-2 select-none">
            <Clock className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
            CAST Cron Schedule
          </h2>
          <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="h-8 rounded bg-[var(--bg-tertiary)] animate-pulse w-4/5" />
            </div>
          ) : data?.error ? (
            <p className="text-xs text-[var(--error)]">{data.error}</p>
          ) : data?.count === 0 && !adding ? (
            <p className="text-sm text-[var(--text-muted)]">No CAST cron entries found.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.entries ?? []).map((entry, i) => (
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
                      aria-label="Run cron entry now"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry)}
                      disabled={deleting === entry}
                      title="Delete entry"
                      aria-label="Delete cron entry"
                      className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Trigger result feedback */}
          {triggerResult && (
            <p
              className={`text-xs font-mono px-2 py-1 rounded ${triggerResult.ok ? 'text-[var(--success)] bg-[var(--success)]/10' : 'text-[var(--error)] bg-[var(--error)]/10'}`}
              role="status"
            >
              {triggerResult.ok ? '✓' : '✗'} {triggerResult.msg.slice(0, 120)}
            </p>
          )}

          {/* Add entry form */}
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
                  Save entry
                </button>
                <button
                  onClick={() => { setAdding(false); setNewSchedule(''); setNewCommand('') }}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
                >
                  Cancel
                </button>
                {newSchedule && !scheduleValid && (
                  <span className="text-xs text-rose-400">Schedule must have exactly 5 fields</span>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors mt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add cron entry
            </button>
          )}
        </div>
      </details>
    </section>
  )
}

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet 4.6 — default' },
  { value: 'haiku',  label: 'Haiku 4.5 — fast/cheap' },
  { value: 'opus',   label: 'Opus 4.6 — powerful' },
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
    <section className="mb-8">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div>
              <h2 className="text-lg font-semibold leading-none">Dispatch Agent</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Dispatch an agent task — runs immediately via Claude CLI
              </p>
            </div>
          </div>
        </div>

        {/* Controls grid */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
          {/* Agent picker */}
          <div className="space-y-1.5">
            <label
              htmlFor="dispatch-agent"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Agent
            </label>
            <select
              id="dispatch-agent"
              value={agentType}
              onChange={e => { setAgentType(e.target.value); setResult(null) }}
              className={selectBase}
              aria-label="Select agent type"
              disabled={agentsLoading}
            >
              {agentsLoading
                ? <option value="" disabled>Loading agents...</option>
                : <option value="" disabled>Select an agent...</option>}
              {agentNames.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Model selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="dispatch-model"
              className="block text-xs font-medium text-[var(--text-secondary)]"
            >
              Model
            </label>
            <select
              id="dispatch-model"
              value={model}
              onChange={e => setModel(e.target.value as typeof model)}
              className={selectBase}
              aria-label="Select model"
            >
              {MODEL_OPTIONS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Task textarea */}
        <div className="space-y-1.5">
          <label
            htmlFor="dispatch-task"
            className="block text-xs font-medium text-[var(--text-secondary)]"
          >
            Task
          </label>
          <textarea
            id="dispatch-task"
            value={taskText}
            onChange={e => { setTaskText(e.target.value); setResult(null) }}
            placeholder="Describe the task for the agent..."
            rows={3}
            className={`${selectBase} resize-y min-h-[80px] leading-relaxed`}
            aria-label="Task description"
          />
        </div>

        {/* Footer: button + inline status */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleDispatch}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            aria-busy={loading}
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Dispatching...' : 'Dispatch'}
          </button>

          {result?.kind === 'success' && (
            <p
              className="text-xs font-mono text-[var(--success)] flex items-center gap-1.5"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">✓</span>
              Dispatched — ID: <span className="font-semibold">{String(result.id).slice(0, 8)}</span>
            </p>
          )}

          {result?.kind === 'error' && (
            <p
              className="text-xs text-[var(--error)] flex items-center gap-1.5"
              role="alert"
              aria-live="assertive"
            >
              <span aria-hidden="true">✗</span>
              {result.message}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

type WeeklyReportResult =
  | { kind: 'success'; reportPath: string }
  | { kind: 'error'; message: string }

type SystemTab = 'health' | 'hooks' | 'privacy' | 'db'

const SYSTEM_TABS: { key: SystemTab; label: string }[] = [
  { key: 'health', label: 'Health' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'db', label: 'DB Explorer' },
]

export default function SystemView() {
  const [activeTab, setActiveTab] = useState<SystemTab>('health')
  const { data: health, isLoading } = useSystemHealth()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()
  const { data: routing } = useRoutingStats()
  const { data: briefings } = useOutputs('briefings')
  const { data: reports } = useOutputs('reports')
  const latestBriefing = briefings?.[0]
  const lastWeeklyReport = reports?.find(r => r.filename.startsWith('weekly-'))

  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyResult, setWeeklyResult] = useState<WeeklyReportResult | null>(null)

  async function handleGenerateWeekly() {
    setWeeklyLoading(true)
    setWeeklyResult(null)
    try {
      const res = await fetch('/api/control/weekly-report', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setWeeklyResult({ kind: 'error', message: body.error ?? `HTTP ${res.status}` })
      } else {
        const body = await res.json() as { success: boolean; reportPath?: string }
        setWeeklyResult({ kind: 'success', reportPath: body.reportPath ?? 'generated' })
      }
    } catch (err) {
      setWeeklyResult({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setWeeklyLoading(false)
    }
  }

  const statRows = health
    ? [
        [
          { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" />, to: '/agents' },
          { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" />, to: '/sessions' },
        ],
        [
          { label: 'Plans', value: health.planCount, icon: <FileText className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Rules', value: health.ruleCount, icon: <Shield className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Project Memories', value: health.projectMemoryCount, icon: <Brain className="w-5 h-5" />, to: '/knowledge' },
          { label: 'Agent Memories', value: health.agentMemoryCount, icon: <Database className="w-5 h-5" />, to: '/knowledge' },
        ],
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">System</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {SYSTEM_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lazy-loaded tabs */}
      {activeTab === 'hooks' && (
        <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading...</div>}>
          <HookHealthView />
        </Suspense>
      )}
      {activeTab === 'privacy' && (
        <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading...</div>}>
          <PrivacyView />
        </Suspense>
      )}
      {activeTab === 'db' && (
        <Suspense fallback={<div className="p-6 text-[var(--text-muted)]">Loading...</div>}>
          <SqliteExplorerView />
        </Suspense>
      )}

      {/* Health tab content */}
      {activeTab === 'health' && <div>

      {/* Stat cards */}
      {isLoading ? (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {statRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {row.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Latest Briefing */}
      <section className="mb-8">
        <Link
          to="/knowledge"
          className="flex items-center justify-between p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/40 transition-colors group no-underline"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)]">
              <FileText className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Morning Briefing</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {latestBriefing
                  ? `Latest: ${latestBriefing.filename?.replace('.md','') ?? 'today'}`
                  : 'No briefings yet — runs daily at 7am'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity">
            View briefings
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>
      </section>

      {/* Weekly Report */}
      <section className="mb-8">
        <div className="flex items-stretch gap-3">
          <Link
            to="/knowledge"
            className="flex-1 flex items-center justify-between p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/40 transition-colors group no-underline"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)]">
                <RefreshCw className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">Weekly Report</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  {lastWeeklyReport
                    ? `Last: ${lastWeeklyReport.filename.replace('weekly-', '').replace('.md', '')}`
                    : 'No reports yet — run /weekly to generate'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity">
              View reports
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
          </Link>

          <div className="flex flex-col justify-center gap-2 shrink-0">
            <button
              onClick={handleGenerateWeekly}
              disabled={weeklyLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              aria-busy={weeklyLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${weeklyLoading ? 'animate-spin' : ''}`} />
              {weeklyLoading ? 'Generating...' : 'Generate'}
            </button>
            {weeklyResult?.kind === 'success' && (
              <p className="text-xs text-[var(--success)] text-center" role="status">Done</p>
            )}
            {weeklyResult?.kind === 'error' && (
              <p className="text-xs text-[var(--error)] max-w-[120px] truncate" role="alert" title={weeklyResult.message}>
                {weeklyResult.message}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Active Hooks */}
      {health && health.hooks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Active Hooks</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Matcher</th>
                  <th className="text-left px-4 py-3 font-medium">Command</th>
                </tr>
              </thead>
              <tbody>
                {health.hooks.map((hook, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/20 text-[var(--accent-hover)]">
                        {hook.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{hook.type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        {hook.matcher ?? '\u2014'}
                        {hook.matcher && <CopyButton text={hook.matcher} size={12} />}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)] max-w-[320px]">
                      <span className="inline-flex items-start gap-1">
                        <span className="break-all">{hook.command ?? hook.description ?? '\u2014'}</span>
                        {hook.command && <CopyButton text={hook.command} size={12} className="shrink-0 mt-[-1px]" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Dispatch History — link card to /routing */}
      <section className="mb-8">
        <Link
          to="/routing"
          className="flex items-center justify-between p-5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl hover:border-[var(--accent)]/40 transition-colors group no-underline"
        >
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-[var(--accent-subtle)]">
              <Route className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Dispatch History</div>
              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                {routing ? `${routing.total} dispatches · ${routing.completed} completed · ${routing.topAgent} top agent` : 'Agent dispatch history, success rates, and per-agent performance'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--accent)] opacity-60 group-hover:opacity-100 transition-opacity">
            View details
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </Link>
      </section>

      {/* Slash Commands */}
      <section className="mb-8">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 select-none">
              <Terminal className="w-4 h-4 text-[var(--accent)]" />
              Slash Commands
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                {health ? `${health.commandCount} available` : '…'}
              </span>
            </h2>
            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {(commands?.map(c => `/${c.name}`) ?? [
                '/plan', '/debug', '/test', '/review', '/commit', '/push', '/secure',
                '/research', '/docs', '/morning', '/merge', '/bash', '/devops', '/orchestrate',
                '/cast',
              ]).map(cmd => (
                <span
                  key={cmd}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/30 hover:text-[var(--accent)] transition-colors"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>

      {/* Skills */}
      <section className="mb-8">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 select-none">
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              Skills
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                {health ? `${health.skillCount} available` : 'loading...'}
              </span>
            </h2>
            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {(skills?.map(s => s.name) ?? [
                'action-items', 'briefing-writer', 'git-activity', 'careful-mode',
                'freeze-mode', 'wizard', 'calendar-fetch', 'inbox-fetch',
                'reminders-fetch', 'calendar-fetch-linux', 'plan', 'loop',
              ]).map(skill => (
                <span
                  key={skill}
                  className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--accent)]/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </details>
      </section>

      {/* Environment */}
      {health && Object.keys(health.env).length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Environment</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {Object.entries(health.env).map(([key, val]) => (
                <div key={key} className="flex gap-3">
                  <dt className="text-[var(--text-muted)] font-medium min-w-[120px] shrink-0">{key}</dt>
                  <dd className="text-[var(--text-secondary)] font-mono text-xs break-all flex items-start gap-1">
                    <span>{maskValue(key, String(val))}</span>
                    {!/key|token|secret|password|auth|credential/i.test(key) && (
                      <CopyButton text={String(val)} size={12} className="shrink-0 mt-[-2px]" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* CAST Cron Schedule — collapsible section */}
      <CronSection />

      {/* Dispatch Agent — control panel */}
      <DispatchAgentPanel />
      </div>}
    </div>
  )
}
