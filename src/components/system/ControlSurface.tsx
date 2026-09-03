import { useState } from 'react'
import { Send, KeyRound, Lock, AlertTriangle } from 'lucide-react'
import { useAgents } from '../../api/useAgents'
import { useControlStatus } from '../../api/useControlEnabled'
import { controlFetch, getControlToken, setControlToken } from '../../lib/controlFetch'

// ── Dispatch Panel ─────────────────────────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'sonnet', label: 'Sonnet 4.6' },
  { value: 'haiku',  label: 'Haiku 4.5' },
  { value: 'opus',   label: 'Opus 4.8' },
  { value: 'fable',  label: 'Fable 5' },
] as const

type DispatchResult =
  | { kind: 'success'; id: string }
  | { kind: 'error'; message: string }

function DispatchAgentPanel() {
  const [agentType, setAgentType] = useState('')
  const [taskText, setTaskText] = useState('')
  const [model, setModel] = useState<'sonnet' | 'haiku' | 'opus' | 'fable'>('sonnet')
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
      const res = await controlFetch('/api/control/dispatch', {
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
        <h2 className="text-sm font-semibold">Dispatch Agent</h2>
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
      <div className="space-y-1.5">
        <label htmlFor="dispatch-task" className="block text-xs font-medium text-[var(--text-secondary)]">Task</label>
        <textarea
          id="dispatch-task"
          value={taskText}
          onChange={e => { setTaskText(e.target.value); setResult(null) }}
          placeholder="Describe the task..."
          rows={3}
          aria-required="true"
          className={`${selectBase} resize-y min-h-[80px]`}
        />
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleDispatch}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          {loading ? 'Dispatching...' : 'Dispatch'}
        </button>
        {result?.kind === 'success' && <p className="text-xs text-[var(--success)]" role="status">Dispatched: {String(result.id).slice(0, 8)}</p>}
        {result?.kind === 'error' && <p className="text-xs text-[var(--error)]" role="alert">{result.message}</p>}
      </div>
    </div>
  )
}

// ── Control Surface (token entry + gated panels) ────────────────────────────

function ControlTokenField() {
  const [token, setToken] = useState(getControlToken())
  const [saved, setSaved] = useState(false)

  function save() {
    setControlToken(token.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-[var(--accent)]" />
        <h2 className="text-sm font-semibold">Control Token</h2>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        The server requires a token for write actions. Paste the value of <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code>; it is stored locally in this browser and sent as <code className="text-[var(--text-secondary)]">X-Dashboard-Token</code>.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste DASHBOARD_TOKEN"
          aria-label="Dashboard control token"
          autoComplete="off"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary,var(--bg-primary))] text-[var(--text-primary)] text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
        />
        <button
          onClick={save}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] font-semibold text-sm hover:opacity-90"
        >
          Save
        </button>
        {saved && <span className="text-xs text-[var(--success)]" role="status">Saved</span>}
      </div>
    </div>
  )
}

export default function ControlSurface() {
  const { data: control } = useControlStatus()

  if (!control?.enabled) {
    return (
      <div className="mt-8 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 flex items-start gap-3">
        <Lock className="w-4 h-4 text-[var(--text-muted)] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Control surface disabled</h2>
          <p className="text-xs text-[var(--text-muted)]">
            The dashboard is read-only. Start the server with <code className="text-[var(--text-secondary)]">CAST_DASHBOARD_CONTROL=1</code> and a <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code> to enable agent dispatch and cron management.
          </p>
        </div>
      </div>
    )
  }

  if (!control.tokenConfigured) {
    return (
      <div className="mt-8 bg-[var(--error)]/5 border border-[var(--error)]/30 rounded-xl p-6 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-[var(--error)] mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Control enabled, but no token configured</h2>
          <p className="text-xs text-[var(--text-muted)]">
            Write actions are refused until <code className="text-[var(--text-secondary)]">DASHBOARD_TOKEN</code> is set on the server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-4">
      <ControlTokenField />
      <DispatchAgentPanel />
    </div>
  )
}
