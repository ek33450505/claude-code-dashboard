import { Plus, X } from 'lucide-react'

interface TerminalTabsProps {
  sessions: Array<{ id: string; label: string }>
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function TerminalTabs({ sessions, activeId, onSelect, onClose, onNew }: TerminalTabsProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] overflow-x-auto shrink-0">
      {sessions.map((session) => {
        const isActive = session.id === activeId
        return (
          <div
            key={session.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 select-none shrink-0 ${
              isActive
                ? 'bg-[var(--accent)] text-[#070A0F] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => onSelect(session.id)}
          >
            <span>{session.label}</span>
            <button
              className={`flex items-center justify-center w-3.5 h-3.5 rounded-sm transition-colors ${
                isActive
                  ? 'hover:bg-black/20 text-[#070A0F]'
                  : 'hover:bg-[var(--border)] text-[var(--text-muted)]'
              }`}
              onClick={(e) => {
                e.stopPropagation()
                onClose(session.id)
              }}
              aria-label={`Close ${session.label}`}
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        )
      })}

      <button
        className="flex items-center justify-center w-7 h-7 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)] transition-all duration-150 shrink-0 ml-1"
        onClick={onNew}
        aria-label="New terminal"
        title="New terminal"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
