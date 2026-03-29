import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Route, Send, Clock
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSystemHealth } from '../api/useSystem'
import { useRoutingStats } from '../api/useRouting'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

function maskValue(key: string, val: string): string {
  return /key|token|secret|password|auth|credential/i.test(key) ? '••••••••' : val
}

interface CronStatus {
  entries: string[]
  count: number
  error?: string
}

function CronSection() {
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

        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 rounded bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="h-8 rounded bg-[var(--bg-tertiary)] animate-pulse w-4/5" />
            </div>
          ) : data?.error ? (
            <p className="text-xs text-[var(--error)]">{data.error}</p>
          ) : data?.count === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No CAST cron entries found.</p>
          ) : (
            <ul className="space-y-2">
              {(data?.entries ?? []).map((entry, i) => (
                <li
                  key={i}
                  className="font-mono text-xs text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 break-all"
                >
                  {entry}
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  )
}

const AGENT_OPTIONS = [
  'code-writer',
  'code-reviewer',
  'debugger',
  'planner',
  'security',
  'merge',
  'researcher',
  'docs',
  'bash-specialist',
  'orchestrator',
  'morning-briefing',
  'devops',
  'commit',
  'push',
  'test-runner',
] as const

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

  const canSubmit = agentType !== '' && taskText.trim() !== '' && !loading

  async function handleQueue() {
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
                Queue an agent task into cast.db — processed by cron every minute
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
            >
              <option value="" disabled>Select an agent...</option>
              {AGENT_OPTIONS.map(a => (
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
            onClick={handleQueue}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            aria-busy={loading}
          >
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Queuing...' : 'Queue Task'}
          </button>

          {result?.kind === 'success' && (
            <p
              className="text-xs font-mono text-[var(--success)] flex items-center gap-1.5"
              role="status"
              aria-live="polite"
            >
              <span aria-hidden="true">✓</span>
              Queued to cast.db — ID: <span className="font-semibold">{String(result.id).slice(0, 8)}</span>
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

export default function SystemView() {
  const { data: health, isLoading } = useSystemHealth()
  const { data: routing } = useRoutingStats()

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
      <h1 className="text-2xl font-bold mb-6">System Overview</h1>

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
              {[
                '/plan', '/debug', '/test', '/review', '/commit', '/push', '/secure',
                '/research', '/docs', '/morning', '/merge', '/bash', '/devops', '/orchestrate',
                '/cast',
              ].map(cmd => (
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
                {health ? `${health.skillCount} available` : '12 available'}
              </span>
            </h2>
            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </summary>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                'action-items', 'briefing-writer', 'git-activity', 'careful-mode',
                'freeze-mode', 'wizard', 'calendar-fetch', 'inbox-fetch',
                'reminders-fetch', 'calendar-fetch-linux', 'plan', 'loop',
              ].map(skill => (
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
    </div>
  )
}
