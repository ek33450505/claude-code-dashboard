import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { MessageSquare, Anchor, Route, Search, Users, GitMerge } from 'lucide-react'
import { useRoutingRules } from '../api/useRouting'
import { useHookDefinitions } from '../api/useHooks'

interface FlowNode {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  subtitle: string
  to?: string
}

function useFlowNodes(): FlowNode[] {
  const { data: rules } = useRoutingRules()
  const { data: hooks } = useHookDefinitions()

  const routeCount = rules?.length ?? 0
  const hookExists = hooks?.some(h => h.event === 'UserPromptSubmit') ?? false

  return [
    { id: 'prompt', label: 'User Prompt', icon: MessageSquare, color: 'var(--text-primary)', subtitle: 'Natural language', to: '/activity' },
    { id: 'hook', label: 'Hook', icon: Anchor, color: '#22d3ee', subtitle: hookExists ? 'UserPromptSubmit' : 'Not configured', to: '/knowledge' },
    { id: 'router', label: 'Router', icon: Route, color: 'var(--accent)', subtitle: 'route.sh', to: '/knowledge' },
    { id: 'match', label: 'Pattern Match', icon: Search, color: '#fbbf24', subtitle: 'routing-table.json', to: '/knowledge' },
    { id: 'dispatch', label: 'Agent Dispatch', icon: Users, color: 'var(--accent)', subtitle: `${routeCount} route${routeCount !== 1 ? 's' : ''}`, to: '/agents' },
    { id: 'post', label: 'Post-Chain', icon: GitMerge, color: '#a78bfa', subtitle: 'auto-follow-up', to: '/system' },
  ]
}

function FlowNodeCard({
  node,
  index,
  isLast,
  pulse,
}: {
  node: FlowNode
  index: number
  isLast: boolean
  pulse?: boolean
}) {
  const Icon = node.icon

  const card = (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: 'easeOut' }}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]
        min-w-[120px] ${pulse ? 'cast-flow-pulse' : ''} ${node.to ? 'cursor-pointer hover:border-[var(--accent)]/30 transition-colors' : ''}`}
    >
      <div
        className="p-2 rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${node.color} 15%, transparent)` }}
      >
        <span style={{ color: node.color }}>
          <Icon className="w-5 h-5" />
        </span>
      </div>
      <div className="text-sm font-semibold text-[var(--text-primary)] whitespace-nowrap">{node.label}</div>
      <div className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">{node.subtitle}</div>
    </motion.div>
  )

  return (
    <div className="flex items-center flex-shrink-0">
      {node.to ? <Link to={node.to} className="no-underline">{card}</Link> : card}

      {/* Arrow connector */}
      {!isLast && (
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.15, duration: 0.25 }}
          className="hidden md:flex items-center mx-1 origin-left"
        >
          <div className="w-6 h-px bg-[var(--accent)]/30" />
          <div
            className="w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px]"
            style={{ borderLeftColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
          />
        </motion.div>
      )}
    </div>
  )
}

function FlowNodeCardVertical({
  node,
  index,
  isLast,
  pulse,
}: {
  node: FlowNode
  index: number
  isLast: boolean
  pulse?: boolean
}) {
  const Icon = node.icon

  const vCard = (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.35, ease: 'easeOut' }}
      className={`relative flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]
        w-full max-w-[280px] ${pulse ? 'cast-flow-pulse' : ''} ${node.to ? 'cursor-pointer hover:border-[var(--accent)]/30 transition-colors' : ''}`}
    >
      <div
        className="p-2 rounded-lg shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${node.color} 15%, transparent)` }}
      >
        <span style={{ color: node.color }}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">{node.label}</div>
        <div className="text-[11px] text-[var(--text-muted)]">{node.subtitle}</div>
      </div>
    </motion.div>
  )

  return (
    <div className="flex flex-col items-center">
      {node.to ? <Link to={node.to} className="no-underline w-full flex justify-center">{vCard}</Link> : vCard}

      {/* Vertical arrow */}
      {!isLast && (
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: index * 0.1 + 0.15, duration: 0.25 }}
          className="flex flex-col items-center my-1 origin-top"
        >
          <div className="w-px h-4 bg-[var(--accent)]/30" />
          <div
            className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px]"
            style={{ borderTopColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
          />
        </motion.div>
      )}
    </div>
  )
}

export default function CASTFlow() {
  const nodes = useFlowNodes()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 768)
  }, [])

  useEffect(() => {
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [checkMobile])

  return (
    <div ref={containerRef}>
      <style>{`
        @keyframes castPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 255, 194, 0.15); }
          50% { box-shadow: 0 0 12px 4px rgba(0, 255, 194, 0.1); }
        }
        .cast-flow-pulse {
          animation: castPulse 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .cast-flow-pulse {
            animation: none !important;
          }
        }
      `}</style>

      {isMobile ? (
        <div className="flex flex-col items-center gap-0">
          {nodes.map((node, i) => (
            <FlowNodeCardVertical
              key={node.id}
              node={node}
              index={i}
              isLast={i === nodes.length - 1}
              pulse={node.id === 'dispatch'}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-0 overflow-x-auto py-2">
          {nodes.map((node, i) => (
            <FlowNodeCard
              key={node.id}
              node={node}
              index={i}
              isLast={i === nodes.length - 1}
              pulse={node.id === 'dispatch'}
            />
          ))}
        </div>
      )}
    </div>
  )
}
