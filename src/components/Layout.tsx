import { useState } from 'react'
import type { ReactNode } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search } from 'lucide-react'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Global Cmd+K / Ctrl+K listener
  useHotkeys('mod+k', (e) => {
    e.preventDefault()
    setPaletteOpen(prev => !prev)
  }, { enableOnFormTags: true })

  return (
    <div className="h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with search hint */}
        <div className="flex items-center justify-end px-6 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/30 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Search
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[10px]">⌘K</kbd>
          </button>
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
