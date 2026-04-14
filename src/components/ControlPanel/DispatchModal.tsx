import { useState, useEffect, useRef } from 'react'
import { X, Send } from 'lucide-react'
import type { AgentDefinition } from '../../types'

interface DispatchModalProps {
  isOpen: boolean
  onClose: () => void
}

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
  { value: 'claude-opus-4-6', label: 'Opus' },
]

export default function DispatchModal({ isOpen, onClose }: DispatchModalProps) {
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [agentType, setAgentType] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Load agent list on open
  useEffect(() => {
    if (!isOpen) return
    const controller = new AbortController()
    fetch('/api/agents', { signal: controller.signal })
      .then(r => r.json())
      .then((data: AgentDefinition[]) => {
        setAgents(Array.isArray(data) ? data : [])
        if (data.length > 0 && !agentType) setAgentType(data[0].name)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [isOpen])

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setError(null)
      setSuccess(false)
      setPrompt('')
      setModel('')
    }
  }, [isOpen])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!agentType.trim()) { setError('Agent type is required'); return }
    if (prompt.trim().length < 10) { setError('Prompt must be at least 10 characters'); return }

    setLoading(true)
    setError(null)
    try {
      const body: Record<string, string> = { agentType: agentType.trim(), prompt: prompt.trim() }
      if (model) body.model = model
      const res = await fetch('/api/control/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Server error ${res.status}`)
      }
      setSuccess(true)
      setTimeout(() => onClose(), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dispatch failed')
    } finally {
      setLoading(false)
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Dispatch Agent</h2>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="px-5 py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <Send size={14} className="text-green-400" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Agent queued successfully</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-4">
            {/* Agent type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Agent Type</label>
              {agents.length > 0 ? (
                <select
                  value={agentType}
                  onChange={e => setAgentType(e.target.value)}
                  className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {agents.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={agentType}
                  onChange={e => setAgentType(e.target.value)}
                  placeholder="e.g. code-reviewer"
                  className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              )}
            </div>

            {/* Prompt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Prompt</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe the task for the agent..."
                rows={4}
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              />
              <span className="text-[10px] text-[var(--text-muted)]">Min 10 characters</span>
            </div>

            {/* Model override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Model Override</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-md px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {MODEL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors rounded-md hover:bg-[var(--bg-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                <Send size={12} />
                {loading ? 'Queuing...' : 'Dispatch'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
