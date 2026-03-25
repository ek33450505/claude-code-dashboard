import { useState } from 'react'
import type { ReactNode } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Search, Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Global Cmd+K / Ctrl+K listener
  useHotkeys('mod+k', (e) => {
    e.preventDefault()
    setPaletteOpen(prev => !prev)
  }, { enableOnFormTags: true })

  return (
    <div className="h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: hidden on mobile unless sidebarOpen, always visible on lg+ */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transition-transform duration-200
        lg:relative lg:translate-x-0 lg:z-auto lg:h-full
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden lg:block" />

          {/* Search button */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--accent)]/30 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[10px] hidden sm:inline">⌘K</kbd>
          </button>
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
