import { useState, useEffect, useRef } from 'react'
import { FileText, Play, Loader2 } from 'lucide-react'

interface PlanFile {
  name: string
  path: string
  modified_at: string
  has_manifest: boolean
}

interface ExecStatus {
  status: string
  [key: string]: unknown
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

/** Extract the first ```json dispatch``` block from plan content, if any. */
function extractManifestBlock(content: string): string | null {
  const match = content.match(/```json\s+dispatch([\s\S]*?)```/i)
  if (match) return match[1].trim()
  return null
}

interface PlanRowProps {
  plan: PlanFile
}

function PlanRow({ plan }: PlanRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [content, setContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [planId, setPlanId] = useState<string | null>(null)
  const [execStatus, setExecStatus] = useState<ExecStatus | null>(null)
  const [executing, setExecuting] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleExpand = async () => {
    if (!expanded && content === null) {
      setLoadingContent(true)
      try {
        // Read plan content via the existing plans route
        const res = await fetch(`/api/plans/${encodeURIComponent(plan.name)}`)
        if (res.ok) {
          const data = await res.json() as { body: string }
          setContent(data.body)
        }
      } catch { /* ignore */ } finally {
        setLoadingContent(false)
      }
    }
    setExpanded(v => !v)
  }

  const handleExecute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setExecuting(true)
    try {
      const res = await fetch('/api/cast/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planFile: plan.name }),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        alert(`Execute failed: ${err.error}`)
        return
      }
      const data = await res.json() as { plan_id: string }
      setPlanId(data.plan_id)
      // Start polling status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/cast/exec/${encodeURIComponent(data.plan_id)}/status`)
          if (statusRes.ok) {
            const status = await statusRes.json() as ExecStatus
            setExecStatus(status)
          }
        } catch { /* ignore */ }
      }, 2_000)
    } catch {
      alert('Failed to execute plan')
    } finally {
      setExecuting(false)
    }
  }

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const manifestBlock = content ? extractManifestBlock(content) : null

  return (
    <div className="border border-[var(--glass-border)] rounded-xl overflow-hidden">
      {/* Row header */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors text-left"
      >
        <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate block">{plan.name}</span>
          <span className="text-[10px] text-[var(--text-muted)]">{relativeDate(plan.modified_at)}</span>
        </div>
        {plan.has_manifest && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 whitespace-nowrap shrink-0">
            manifest
          </span>
        )}
        <button
          onClick={handleExecute}
          disabled={executing}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[var(--accent)] text-[#070A0F] hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
        >
          {executing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Play className="w-3 h-3" />
          )}
          Execute
        </button>
        <span className="text-[var(--text-muted)] text-xs shrink-0 ml-1">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
          {loadingContent && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-muted)]">Loading...</span>
            </div>
          )}
          {manifestBlock && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                JSON Dispatch Block
              </div>
              <pre className="text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                {manifestBlock}
              </pre>
            </div>
          )}
          {planId && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                Exec Status — plan_id: <span className="font-mono text-[var(--accent)]">{planId}</span>
              </div>
              <pre className="text-xs font-mono bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                {execStatus ? JSON.stringify(execStatus, null, 2) : '{ "status": "launching..." }'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PlansView() {
  const [plans, setPlans] = useState<PlanFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cast/plans')
      .then(r => r.json())
      .then((data: PlanFile[]) => setPlans(data))
      .catch(() => setError('Failed to load plans'))
  }, [])

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Cast Exec Plans</h1>
        {plans !== null && (
          <span className="text-xs text-[var(--text-muted)]">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {error && (
        <div className="bento-card p-4 border-[var(--error)]/30">
          <span className="text-sm text-[var(--error)]">{error}</span>
        </div>
      )}

      {plans === null && !error && (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Loading plans...</span>
        </div>
      )}

      {plans !== null && plans.length === 0 && (
        <div className="bento-card p-8 flex flex-col items-center gap-3">
          <FileText className="w-8 h-8 text-[var(--text-muted)] opacity-30" />
          <span className="text-sm text-[var(--text-muted)]">No plans found</span>
          <span className="text-xs text-[var(--text-muted)] opacity-60">
            Add *.md files to ~/.claude/plans/ to see them here
          </span>
        </div>
      )}

      {plans !== null && plans.length > 0 && (
        <div className="space-y-2">
          {plans.map(plan => (
            <PlanRow key={plan.name} plan={plan} />
          ))}
        </div>
      )}
    </div>
  )
}
