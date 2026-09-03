import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Play, Trash2, Plus, Check, Lock } from 'lucide-react'
import { useCastdStatus } from '../../api/useCastdControl'
import { useControlStatus } from '../../api/useControlEnabled'
import { controlFetch } from '../../lib/controlFetch'
import StatusPill from '../StatusPill'

function isValidCronSchedule(schedule: string): boolean {
  return schedule.trim().split(/\s+/).length === 5
}

function extractCronCommand(line: string): string {
  const parts = line.trim().split(/\s+/)
  return parts.slice(5).join(' ')
}

export default function CronTab() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useCastdStatus()
  const { data: control } = useControlStatus()
  const controlEnabled = control?.enabled ?? false

  const [adding, setAdding] = useState(false)
  const [newSchedule, setNewSchedule] = useState('')
  const [newCommand, setNewCommand] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [triggerResult, setTriggerResult] = useState<{ entry: string; ok: boolean; msg: string } | null>(null)

  async function addEntry() {
    if (!newSchedule.trim() || !newCommand.trim()) return
    const res = await controlFetch('/api/castd/cron', {
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
      await controlFetch('/api/castd/cron', {
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
      const res = await controlFetch('/api/castd/trigger', {
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
      <div className="flex items-center gap-2">
        <StatusPill
          status={data?.running ? 'running' : 'idle'}
          label={data?.running ? `${data.count} cron ${data.count === 1 ? 'entry' : 'entries'} scheduled` : 'No cron entries'}
        />
      </div>

      {data?.error && <p role="alert" className="text-xs text-[var(--error)]">{data.error}</p>}

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
              {controlEnabled && (
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button
                    onClick={() => triggerEntry(entry)}
                    disabled={triggering === entry}
                    aria-label={`Run now: ${entry}`}
                    className="inline-flex items-center justify-center p-1.5 min-w-6 min-h-6 rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-40"
                  >
                    <Play className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => deleteEntry(entry)}
                    disabled={deleting === entry}
                    aria-label={`Delete cron entry: ${entry}`}
                    className="inline-flex items-center justify-center p-1.5 min-w-6 min-h-6 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              )}
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

      {!controlEnabled && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <Lock className="w-3 h-3" aria-hidden="true" />
          Read-only — enable the control surface to add, run, or delete cron entries.
        </p>
      )}

      {controlEnabled && (adding ? (
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
                aria-invalid={Boolean(newSchedule) && !scheduleValid}
                aria-describedby={Boolean(newSchedule) && !scheduleValid ? 'cron-schedule-error' : undefined}
                className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono bg-[var(--bg-tertiary)] border ${scheduleValid || !newSchedule ? 'border-[var(--border)]' : 'border-rose-400'} text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]`}
              />
              {Boolean(newSchedule) && !scheduleValid && (
                <p id="cron-schedule-error" role="alert" className="text-[10px] text-rose-400">
                  Schedule must have 5 space-separated fields.
                </p>
              )}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
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
      ))}
    </div>
  )
}
