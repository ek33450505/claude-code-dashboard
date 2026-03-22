import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Shield, Layers, Briefcase, Star, GitMerge } from 'lucide-react'
import { AGENT_CATEGORIES, CATEGORY_COLORS } from '../utils/agentCategories'
import type { AgentCategory } from '../utils/agentCategories'

interface CategoryNode {
  name: AgentCategory
  icon: React.ComponentType<{ className?: string }>
  count: number
}

const categories: CategoryNode[] = [
  { name: 'Core', icon: Shield, count: AGENT_CATEGORIES.Core.length },
  { name: 'Extended', icon: Layers, count: AGENT_CATEGORIES.Extended.length },
  { name: 'Productivity', icon: Briefcase, count: AGENT_CATEGORIES.Productivity.length },
  { name: 'Professional', icon: Star, count: AGENT_CATEGORIES.Professional.length },
  { name: 'Orchestration', icon: GitMerge, count: AGENT_CATEGORIES.Orchestration.length },
]

const CATEGORY_TAILWIND_COLORS: Record<AgentCategory, string> = {
  Core: '#60a5fa',
  Extended: '#a78bfa',
  Productivity: '#34d399',
  Professional: '#fbbf24',
  Orchestration: '#22d3ee',
}

interface DelegationDiagramProps {
  onCategoryClick?: (category: AgentCategory) => void
}

export default function DelegationDiagram({ onCategoryClick }: DelegationDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className="relative">
      {/* Central Claude Node */}
      <div className="flex flex-col items-center mb-8">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative p-6 rounded-2xl bg-[var(--bg-secondary)] border-2 border-[var(--accent)]/40 shadow-lg shadow-[#00FFC2]/10"
        >
          <div className="absolute inset-0 rounded-2xl bg-[var(--accent)]/5" />
          <div className="relative flex flex-col items-center gap-2">
            <div className="p-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
              <Terminal className="w-7 h-7 text-[var(--accent)]" />
            </div>
            <div className="text-lg font-bold text-[var(--text-primary)]">Claude</div>
            <div className="text-xs text-[var(--accent)] font-medium tracking-wide uppercase">Senior Developer</div>
          </div>
        </motion.div>

        {/* Connector lines from center down */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="w-px h-8 bg-gradient-to-b from-[var(--accent)]/40 to-[var(--accent)]/10 origin-top"
        />
      </div>

      {/* Category Nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categories.map((cat, i) => {
          const colors = CATEGORY_COLORS[cat.name]
          const accentColor = CATEGORY_TAILWIND_COLORS[cat.name]
          const Icon = cat.icon

          return (
            <motion.button
              key={cat.name}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.35, ease: 'easeOut' }}
              onClick={() => onCategoryClick?.(cat.name)}
              className={`relative p-4 rounded-xl bg-[var(--bg-secondary)] border ${colors.border} text-left
                hover:border-opacity-60 transition-all duration-200 cursor-pointer group
                hover:shadow-md`}
              style={{ ['--cat-color' as string]: accentColor }}
            >
              {/* Top connector dot */}
              <div
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 hidden lg:block"
                style={{ borderColor: accentColor, backgroundColor: 'var(--bg-primary)' }}
              />

              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                <span className={`text-sm font-semibold ${colors.text}`}>{cat.name}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {cat.count} agent{cat.count !== 1 ? 's' : ''}
              </div>

              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: `inset 0 0 20px ${accentColor}10` }}
              />
            </motion.button>
          )
        })}
      </div>

      {/* SVG connector lines (desktop only) */}
      <svg
        className="absolute top-0 left-0 w-full h-full pointer-events-none hidden lg:block"
        style={{ zIndex: 0 }}
      >
        {categories.map((cat, i) => {
          const accentColor = CATEGORY_TAILWIND_COLORS[cat.name]
          // Calculate approximate positions for 5 evenly spaced columns
          const colPercent = (i + 0.5) / 5 * 100

          return (
            <motion.line
              key={cat.name}
              x1="50%"
              y1="0"
              x2={`${colPercent}%`}
              y2="100%"
              stroke={accentColor}
              strokeWidth="1"
              strokeOpacity="0.15"
              strokeDasharray="4 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
            />
          )
        })}
      </svg>
    </div>
  )
}
