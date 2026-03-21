import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Activity, History, BarChart2, Users, BookOpen, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import logo from '../assets/logo.svg'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/sessions', label: 'Sessions', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/system', label: 'System', icon: Settings },
]

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed)

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed))
  }, [collapsed])

  return (
    <div className="relative shrink-0">
      <aside
        className={`${collapsed ? 'w-16' : 'w-64'} h-full flex flex-col border-r border-[var(--glass-border)] transition-all duration-300 ease-in-out glass-surface`}
      >
        {/* Logo / Title */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)] min-h-[68px]">
          <img src={logo} alt="Claude Code Dashboard" className="w-8 h-8 shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden whitespace-nowrap">
              <span className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Claude Code</span>
              <span className="block text-xs text-[var(--text-muted)] -mt-0.5">Dashboard</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/' || to === '/activity'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center' : ''} gap-3 ${collapsed ? 'px-0 py-2.5' : 'px-3 py-2.5'} rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--accent)] text-[#070A0F] font-semibold shadow-md shadow-[#00FFC2]/20'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                }`
              }
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Status indicator */}
        <div className={`px-4 py-4 border-t border-[var(--border)] flex items-center ${collapsed ? 'justify-center' : ''} gap-2 text-xs text-[var(--text-muted)]`}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
          </span>
          {!collapsed && 'Connected'}
        </div>
      </aside>

      {/* Floating edge toggle button */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute top-20 -right-3 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--bg-tertiary)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all duration-150 shadow-lg"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
