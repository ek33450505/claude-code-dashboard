import { useState, useMemo, useCallback } from 'react'
import { Brain, Search, ChevronDown, ChevronUp, Pencil, Trash2, Check, X, Clock, RefreshCw } from 'lucide-react'
import { useAgentMemory, useProjectMemory } from '../api/useMemory'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MemoryFile } from '../types'
import { relativeTime } from '../utils/time'

// --- Backup status types ---
interface BackupStatus {
  lastBackup: string | null
  logSizeBytes: number | null
}

// --- BackupStatusWidget ---
function BackupStatusWidget() {
  const [triggering, setTriggering] = useState(false)
  const [triggerOutput, setTriggerOutput] = useState<string | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery<BackupStatus>({
    queryKey: ['memory', 'backup-status'],
    queryFn: () => fetch('/api/memory/backup-status').then(r => r.json()),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  async function handleTrigger() {
    setTriggering(true)
    setTriggerOutput(null)
    setTriggerError(null)
    const controller = new AbortController()
    try {
      const res = await fetch('/api/memory/backup-trigger', { method: 'POST', signal: controller.signal })
      const json = await res.json() as { ok: boolean; output?: string; error?: string }
      if (json.ok) {
        setTriggerOutput(json.output ?? 'Backup dry-run complete.')
        refetch()
      } else {
        setTriggerError(json.error ?? 'Backup trigger failed.')
      }
    } catch (err) {
      setTriggerError(String(err))
    } finally {
      setTriggering(false)
    }
  }

  const lastBackupLabel = isLoading
    ? 'Checking...'
    : data?.lastBackup
      ? `Last backup: ${relativeTime(data.lastBackup)}`
      : 'Never backed up'

  return (
    <div className="bento-card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <Clock className="w-4 h-4 text-[var(--accent)] shrink-0" />
          <span>{lastBackupLabel}</span>
          {data?.logSizeBytes != null && (
            <span className="text-xs text-[var(--text-muted)]">
              ({(data.logSizeBytes / 1024).toFixed(1)} KB log)
            </span>
          )}
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${triggering ? 'animate-spin' : ''}`} />
          {triggering ? 'Running...' : 'Run Backup (dry run)'}
        </button>
      </div>
      {triggerOutput && (
        <pre className="text-xs text-emerald-400 bg-[var(--bg-secondary)] rounded p-2 max-h-32 overflow-auto font-mono whitespace-pre-wrap">
          {triggerOutput}
        </pre>
      )}
      {triggerError && (
        <p className="text-xs text-rose-400">{triggerError}</p>
      )}
    </div>
  )
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  user: { bg: 'rgba(0,255,194,0.15)', text: '#00FFC2' },
  feedback: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  project: { bg: 'rgba(96,165,250,0.15)', text: '#60A5FA' },
  reference: { bg: 'rgba(167,139,250,0.15)', text: '#A78BFA' },
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {type}
    </span>
  )
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)]">
      {count}
    </span>
  )
}

function MemoryCard({ mem, owner }: { mem: MemoryFile; owner: string }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(mem.body ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'ok' | 'error'>('idle')

  const body = mem.body ?? ''
  const isLong = body.length > 200
  const filename = mem.filename ?? mem.path.split('/').pop() ?? ''

  async function handleSave() {
    if (!filename || !mem.agent) return
    setSaving(true)
    setSaveStatus('idle')
    try {
      const res = await fetch(`/api/memory/agent/${encodeURIComponent(mem.agent)}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaveStatus('ok')
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['memory', 'agent'] })
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!filename || !mem.agent) return
    if (!window.confirm(`Delete memory "${mem.name ?? filename}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/memory/agent/${encodeURIComponent(mem.agent)}/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      queryClient.invalidateQueries({ queryKey: ['memory', 'agent'] })
    } catch {
      alert('Failed to delete memory.')
      setDeleting(false)
    }
  }

  return (
    <div className="bento-card p-4 space-y-3">
      <div className="space-y-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-sm text-[var(--text-primary)] truncate flex-1">
            {mem.name ?? mem.path.split('/').pop() ?? 'Memory'}
          </div>
          {/* Only agent memories (with filename + agent) support edit/delete */}
          {filename && mem.agent && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setEditing(e => !e); setEditBody(mem.body ?? '') }}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                aria-label="Edit memory"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 transition-colors disabled:opacity-40"
                aria-label="Delete memory"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mem.type && <TypeBadge type={mem.type} />}
          <span className="text-xs text-[var(--text-muted)]">{owner}</span>
          {mem.description && (
            <span className="text-xs text-[var(--text-muted)] italic truncate max-w-[240px]">
              {mem.description}
            </span>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={8}
            className="w-full text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--accent)]/40 rounded p-2 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-y leading-relaxed"
            aria-label="Edit memory body"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent)] text-[#070A0F] text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Check className="w-3 h-3" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setSaveStatus('idle') }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] text-xs hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            {saveStatus === 'ok' && <span className="text-xs text-emerald-400">Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-rose-400">Save failed</span>}
          </div>
        </div>
      ) : (
        <div
          className="text-xs text-[var(--text-secondary)] cursor-pointer whitespace-pre-wrap font-mono bg-[var(--bg-secondary)] rounded p-2 leading-relaxed"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? body : `${body.slice(0, 200)}${isLong ? '...' : ''}`}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]" title={mem.modifiedAt ? new Date(mem.modifiedAt).toLocaleString() : undefined}>
          {mem.modifiedAt ? relativeTime(mem.modifiedAt) : '—'}
        </span>
        {isLong && !editing && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-80"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" /> Collapse</>
              : <><ChevronDown className="w-3 h-3" /> Expand</>}
          </button>
        )}
      </div>
    </div>
  )
}

type Tab = 'agent' | 'project'

export default function MemoryBrowserView() {
  const [tab, setTab] = useState<Tab>('agent')
  const [search, setSearch] = useState('')

  const agentQuery = useAgentMemory()
  const projectQuery = useProjectMemory()

  const agentMemories = agentQuery.data ?? []
  const projectMemories = projectQuery.data ?? []

  const filtered = useMemo(() => {
    const list: Array<{ mem: MemoryFile; owner: string }> =
      tab === 'agent'
        ? agentMemories.map(m => ({ mem: m, owner: m.agent }))
        : projectMemories.map(m => ({ mem: m, owner: m.agent }))

    if (!search.trim()) return list

    const q = search.trim().toLowerCase()
    return list.filter(({ mem, owner }) =>
      owner.toLowerCase().includes(q) ||
      (mem.name ?? '').toLowerCase().includes(q) ||
      (mem.body ?? '').toLowerCase().includes(q) ||
      (mem.description ?? '').toLowerCase().includes(q)
    )
  }, [tab, search, agentMemories, projectMemories])

  const isLoading = agentQuery.isLoading || projectQuery.isLoading
  const error = agentQuery.error ?? projectQuery.error

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next)
    setSearch('')
  }, [])

  if (isLoading) {
    return (
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bento-card p-5 h-32 animate-pulse bg-[var(--bg-secondary)]" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bento-card p-6 text-[var(--error)]">Failed to load memories.</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Memory Browser</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Agent memories from ~/.claude/agent-memory-local/ · Project memories from cast.db and agent memory files
        </p>
      </div>

      <BackupStatusWidget />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--glass-border)]">
        {(['agent', 'project'] as Tab[]).map(t => {
          const count = t === 'agent' ? agentMemories.length : projectMemories.length
          return (
            <button
              key={t}
              onClick={() => handleTabChange(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t === 'agent' ? 'Agent Memories' : 'Project Memories'}
              <CountBadge count={count} />
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by agent, name, or content..."
          className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Memory grid */}
      {filtered.length === 0 ? (
        <div className="bento-card p-10 text-center text-[var(--text-muted)]">
          <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <div className="font-medium">No memories found</div>
          <div className="text-sm mt-1">
            {search
              ? 'No memories match your search'
              : tab === 'agent'
                ? 'No agent memories found in ~/.claude/agent-memory-local/'
                : 'No project memories found'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(({ mem, owner }) => (
            <MemoryCard
              key={mem.path}
              mem={mem}
              owner={owner}
            />
          ))}
        </div>
      )}
    </div>
  )
}
