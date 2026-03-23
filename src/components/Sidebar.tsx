import { useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Activity, History, BarChart2, Users, BookOpen, Settings } from 'lucide-react'
import { motion, useScroll } from 'framer-motion'
import logo from '../assets/logo.svg'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/sessions', label: 'Sessions', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/knowledge', label: 'Knowledge', icon: BookOpen },
  { to: '/system', label: 'System', icon: Settings },
]

export default function Sidebar() {
  const sidebarRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ container: sidebarRef })

  return (
    <div className="relative shrink-0">
      <aside
        ref={sidebarRef}
        className="w-16 h-full flex flex-col border-r border-[var(--glass-border)] glass-surface relative overflow-y-auto"
      >
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent)] origin-left z-10"
          style={{ scaleX: scrollYProgress }}
        />
        {/* Logo */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="block" />}>
              <div className="flex items-center justify-center px-4 py-5 border-b border-[var(--border)] min-h-[68px]">
                <img src={logo} alt="CLAW" className="w-8 h-8 shrink-0" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span className="font-bold">CLAW</span>
              <span className="block text-xs text-[var(--text-muted)]">Agent Dispatch Control</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          <TooltipProvider>
            {navItems.map(({ to, label, icon: Icon }) => (
              <Tooltip key={to}>
                <TooltipTrigger render={<span className="block" />}>
                  <NavLink
                    to={to}
                    viewTransition
                    end={to === '/' || to === '/activity'}
                    className={({ isActive }) =>
                      `flex items-center justify-center px-0 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-[var(--accent)] text-[#070A0F] font-semibold shadow-md shadow-[#00FFC2]/20'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--text-primary)]'
                      }`
                    }
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>

        {/* Status indicator */}
        <div className="px-4 py-4 border-t border-[var(--border)] flex items-center justify-center">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
          </span>
        </div>
      </aside>
    </div>
  )
}
