import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useSseState } from '../state/sseState'
import {
  LayoutDashboard, BarChart3, History, Settings, FileText, Network, Bot, ScrollText,
} from 'lucide-react'
import { motion, useScroll } from 'framer-motion'
import logo from '../assets/logo.svg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

// ── 4-item flat nav ────────────────────────────────────────────────────────

const navItems = [
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard, end: true },
  { to: '/sessions',      label: 'Sessions',      icon: History,         end: false },
  { to: '/analytics',     label: 'Analytics',     icon: BarChart3,       end: false },
  { to: '/swarm',         label: 'Swarm',         icon: Network,         end: false },
  { to: '/work-log',      label: 'Work Log',      icon: ScrollText,      end: false },
  { to: '/agents',        label: 'Agents',         icon: Bot,             end: false },
  { to: '/system',        label: 'System',        icon: Settings,        end: false },
  { to: '/docs',          label: 'Docs',          icon: FileText,        end: false },
]

interface SidebarProps {
  onNavigate?: () => void
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ container: sidebarRef })
  const { connected } = useSseState()

  return (
    <div className="relative shrink-0 h-full">
      <aside
        ref={sidebarRef}
        className="w-52 h-full flex flex-col border-r border-[var(--glass-border)] glass-surface relative overflow-y-auto"
      >
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent)] origin-left z-10"
          style={{ scaleX: scrollYProgress }}
        />

        {/* Logo */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="block" />}>
              <div className="flex items-center gap-2.5 px-4 py-5 border-b border-[var(--border)] min-h-[68px]">
                <img src={logo} alt="CAST" className="w-8 h-8 shrink-0" />
                <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">CAST</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="font-bold">CAST</span>
              <span className="block text-xs text-[var(--text-muted)]">Agent Dispatch Control</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Navigation — 4 items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <TooltipProvider>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <Tooltip key={to}>
                <TooltipTrigger render={<span className="block" />}>
                  <NavLink
                    to={to}
                    viewTransition
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-[var(--accent)] text-[#070A0F] font-semibold shadow-md shadow-[#00FFC2]/20'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                      }`
                    }
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>

        {/* Status indicator */}
        <div className="px-4 py-4 border-t border-[var(--border)] flex items-center gap-2">
          {connected ? (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Connected</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--text-muted)]" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Disconnected</span>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
