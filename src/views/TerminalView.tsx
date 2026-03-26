import { useState, useCallback } from 'react'
import { TerminalSquare } from 'lucide-react'
import TerminalTabs from '../components/Terminal/TerminalTabs'
import TerminalPanel from '../components/Terminal/TerminalPanel'

interface TerminalSession {
  id: string
  label: string
}

export default function TerminalView() {
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [counter, setCounter] = useState(1)
  const [loading, setLoading] = useState(false)

  const handleNew = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/terminal/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error('Failed to create session')
      const data = await res.json() as { id: string }
      const label = `terminal-${counter}`
      setSessions((prev) => [...prev, { id: data.id, label }])
      setActiveId(data.id)
      setCounter((n) => n + 1)
    } catch (err) {
      console.error('[TerminalView] Failed to create session:', err)
    } finally {
      setLoading(false)
    }
  }, [loading, counter])

  const handleClose = useCallback(async (id: string) => {
    try {
      await fetch(`/api/terminal/sessions/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('[TerminalView] Failed to kill session:', err)
    }
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (activeId === id) {
        // Activate the previous tab, or null if none remain
        const idx = prev.findIndex((s) => s.id === id)
        const newActive = next[idx - 1]?.id ?? next[0]?.id ?? null
        setActiveId(newActive)
      }
      return next
    })
  }, [activeId])

  const handleSelect = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {sessions.length > 0 ? (
        <>
          <TerminalTabs
            sessions={sessions}
            activeId={activeId}
            onSelect={handleSelect}
            onClose={handleClose}
            onNew={handleNew}
          />
          <div className="flex-1 relative overflow-hidden">
            {sessions.map((session) => (
              <div key={session.id} className="absolute inset-0">
                <TerminalPanel
                  sessionId={session.id}
                  isActive={session.id === activeId}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[var(--text-muted)]">
          <TerminalSquare className="w-12 h-12 opacity-20" />
          <p className="text-sm">No terminal sessions open</p>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[#070A0F] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            onClick={handleNew}
            disabled={loading}
          >
            <TerminalSquare className="w-4 h-4" />
            New Terminal
          </button>
        </div>
      )}
    </div>
  )
}
