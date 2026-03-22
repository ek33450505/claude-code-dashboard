import { useRef, useLayoutEffect, useState, useCallback, useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Terminal, Shield, Layers, Briefcase, Star, GitMerge, FileCode2 } from 'lucide-react'
import { AGENT_CATEGORIES, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS } from '../utils/agentCategories'
import type { AgentCategory } from '../utils/agentCategories'

interface CategoryNode {
  name: AgentCategory
  icon: React.ComponentType<{ className?: string }>
  count: number
  description: string
  agents: readonly string[]
}

const categories: CategoryNode[] = [
  { name: 'Core', icon: Shield, count: AGENT_CATEGORIES.Core.length, description: CATEGORY_DESCRIPTIONS.Core, agents: AGENT_CATEGORIES.Core },
  { name: 'Extended', icon: Layers, count: AGENT_CATEGORIES.Extended.length, description: CATEGORY_DESCRIPTIONS.Extended, agents: AGENT_CATEGORIES.Extended },
  { name: 'Productivity', icon: Briefcase, count: AGENT_CATEGORIES.Productivity.length, description: CATEGORY_DESCRIPTIONS.Productivity, agents: AGENT_CATEGORIES.Productivity },
  { name: 'Professional', icon: Star, count: AGENT_CATEGORIES.Professional.length, description: CATEGORY_DESCRIPTIONS.Professional, agents: AGENT_CATEGORIES.Professional },
  { name: 'Orchestration', icon: GitMerge, count: AGENT_CATEGORIES.Orchestration.length, description: CATEGORY_DESCRIPTIONS.Orchestration, agents: AGENT_CATEGORIES.Orchestration },
]

const ACCENT_COLORS: Record<AgentCategory, string> = {
  Core: '#60a5fa',
  Extended: '#a78bfa',
  Productivity: '#34d399',
  Professional: '#fbbf24',
  Orchestration: '#22d3ee',
}

interface ConnectorPath {
  d: string
  color: string
  index: number
}

interface DelegationDiagramProps {
  onCategoryClick?: (category: AgentCategory) => void
}

export default function DelegationDiagram({ onCategoryClick }: DelegationDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const centralRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [paths, setPaths] = useState<ConnectorPath[]>([])
  const [hoveredCategory, setHoveredCategory] = useState<AgentCategory | null>(null)
  const reduceMotion = useReducedMotion()
  const gradientId = useId()

  const measurePaths = useCallback(() => {
    const container = containerRef.current
    const central = centralRef.current
    if (!container || !central) return

    const containerRect = container.getBoundingClientRect()
    const centralRect = central.getBoundingClientRect()

    // Center bottom of the Claude node
    const cx = centralRect.left + centralRect.width / 2 - containerRect.left
    const cy = centralRect.bottom - containerRect.top

    const newPaths: ConnectorPath[] = []

    categories.forEach((cat, i) => {
      const card = cardRefs.current.get(cat.name)
      if (!card) return

      const cardRect = card.getBoundingClientRect()
      // Center top of each card
      const tx = cardRect.left + cardRect.width / 2 - containerRect.left
      const ty = cardRect.top - containerRect.top

      // Cubic bezier curve from Claude to category
      const midY = cy + (ty - cy) * 0.5
      const d = `M ${cx} ${cy} C ${cx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`

      newPaths.push({
        d,
        color: ACCENT_COLORS[cat.name],
        index: i,
      })
    })

    setPaths(newPaths)
  }, [])

  useLayoutEffect(() => {
    measurePaths()
    window.addEventListener('resize', measurePaths)
    return () => window.removeEventListener('resize', measurePaths)
  }, [measurePaths])

  const setCardRef = useCallback((name: string) => (el: HTMLButtonElement | null) => {
    if (el) {
      cardRefs.current.set(name, el)
    } else {
      cardRefs.current.delete(name)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative py-4">
      {/* ─── SVG Connector Lines ─── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          {categories.map((cat) => (
            <linearGradient key={cat.name} id={`${gradientId}-grad-${cat.name}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00FFC2" stopOpacity="0.5" />
              <stop offset="100%" stopColor={ACCENT_COLORS[cat.name]} stopOpacity="0.4" />
            </linearGradient>
          ))}
        </defs>

        {paths.map((p) => {
          const catName = categories[p.index].name
          const isHovered = hoveredCategory === catName
          const isAnyHovered = hoveredCategory !== null

          return (
            <g key={catName}>
              {/* Glow layer */}
              <motion.path
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={isHovered ? 3 : 1.5}
                strokeOpacity={isHovered ? 0.3 : 0}
                filter="blur(4px)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.5 + p.index * 0.12, duration: 0.6 }}
              />
              {/* Main path */}
              <motion.path
                d={p.d}
                fill="none"
                stroke={`url(#${gradientId}-grad-${catName})`}
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeOpacity={isAnyHovered && !isHovered ? 0.08 : isHovered ? 0.6 : 0.2}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.5 + p.index * 0.12, duration: 0.6 }}
                style={{
                  transition: 'stroke-width 0.2s, stroke-opacity 0.2s',
                }}
              />
              {/* Animated pulse dot flowing down the path */}
              {!reduceMotion && (
                <circle r="3" fill={p.color} opacity={isAnyHovered && !isHovered ? 0.05 : 0.5}>
                  <animateMotion dur="3s" repeatCount="indefinite" begin={`${p.index * 0.6}s`}>
                    <mpath href={`#path-${gradientId}-${p.index}`} />
                  </animateMotion>
                </circle>
              )}
              {/* Hidden path for animateMotion reference */}
              <path id={`path-${gradientId}-${p.index}`} d={p.d} fill="none" stroke="none" />
            </g>
          )
        })}
      </svg>

      {/* ─── Central Claude Node ─── */}
      <div className="flex flex-col items-center mb-12" style={{ position: 'relative', zIndex: 2 }}>
        <motion.div
          ref={centralRef}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative group"
        >
          {/* Outer glow ring */}
          <div className="absolute -inset-3 rounded-3xl bg-[var(--accent)]/5 blur-xl group-hover:bg-[var(--accent)]/10 transition-colors duration-500" />

          {/* Moving border effect - rotating conic gradient */}
          {!reduceMotion && (
            <div className="absolute -inset-[2px] rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0 animate-spin"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, rgba(0,255,194,0.3) 10%, transparent 20%, transparent 80%, rgba(0,255,194,0.2) 90%, transparent 100%)',
                  animationDuration: '4s',
                }}
              />
            </div>
          )}

          <div className="relative p-8 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--accent)]/30 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                <Terminal className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">Claude</div>
              <div className="text-xs text-[var(--accent)] font-semibold tracking-widest uppercase">Senior Developer</div>

              {/* CLAUDE.md badge */}
              <div className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                <FileCode2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[11px] font-mono text-[var(--text-muted)]">CLAUDE.md</span>
                <span className="text-[10px] text-[var(--text-muted)] ml-1">= main agent</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Category Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" style={{ position: 'relative', zIndex: 2 }}>
        {categories.map((cat, i) => {
          const colors = CATEGORY_COLORS[cat.name]
          const accentColor = ACCENT_COLORS[cat.name]
          const Icon = cat.icon
          const isHovered = hoveredCategory === cat.name

          return (
            <motion.button
              key={cat.name}
              ref={setCardRef(cat.name)}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => onCategoryClick?.(cat.name)}
              onMouseEnter={() => setHoveredCategory(cat.name)}
              onMouseLeave={() => setHoveredCategory(null)}
              className={`relative p-5 rounded-xl bg-[var(--bg-secondary)] border ${colors.border} text-left
                transition-all duration-300 cursor-pointer group overflow-hidden`}
              style={{
                boxShadow: isHovered ? `0 0 30px ${accentColor}15, 0 8px 20px rgba(0,0,0,0.3)` : 'none',
                transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                borderColor: isHovered ? `${accentColor}40` : undefined,
              }}
            >
              {/* Spotlight gradient on hover */}
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at 50% 0%, ${accentColor}12 0%, transparent 70%)`,
                }}
              />

              {/* Top connector dot */}
              <div
                className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full hidden lg:block transition-all duration-300"
                style={{
                  backgroundColor: isHovered ? accentColor : 'var(--bg-primary)',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: accentColor,
                  boxShadow: isHovered ? `0 0 8px ${accentColor}60` : 'none',
                }}
              />

              <div className="relative">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={`p-2 rounded-lg ${colors.bg} transition-all duration-300 ${isHovered ? 'scale-110' : ''}`}>
                    <Icon className={`w-4 h-4 ${colors.text}`} />
                  </div>
                  <span className={`text-sm font-bold ${colors.text}`}>{cat.name}</span>
                </div>

                <div className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed line-clamp-2">
                  {cat.description}
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                  >
                    {cat.count} agents
                  </span>
                </div>

                {/* Agent name list on hover */}
                <div className={`mt-3 pt-3 border-t border-[var(--glass-border)] transition-all duration-300 overflow-hidden ${
                  isHovered ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="flex flex-wrap gap-1">
                    {cat.agents.map((agent) => (
                      <span
                        key={agent}
                        className="inline-block px-1.5 py-0.5 text-[10px] rounded font-mono"
                        style={{ backgroundColor: `${accentColor}10`, color: `${accentColor}cc` }}
                      >
                        {agent}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
