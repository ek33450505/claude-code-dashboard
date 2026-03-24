import { useState, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Wrench, Plus, X, Route, Shield, Layers, Briefcase, Star, GitMerge, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAgents } from '../api/useAgents'
import { useCreateAgent } from '../api/useAgentMutations'
import { useRoutingTable } from '../api/useRouting'
import { useAgentMemory } from '../api/useMemory'
import AgentEditForm from '../components/AgentEditForm'
import { SpotlightCard } from '../components/effects/SpotlightCard'
import { AGENT_CATEGORIES, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS } from '../utils/agentCategories'
import type { AgentCategory } from '../utils/agentCategories'
import type { AgentDefinition } from '../types'

const MODEL_COLORS: Record<string, { bg: string; text: string }> = {
  sonnet: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  haiku: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  opus: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
}

function getModelStyle(model: string) {
  return MODEL_COLORS[model] ?? { bg: 'bg-[var(--bg-tertiary)]', text: 'text-[var(--text-secondary)]' }
}

const CATEGORY_ICONS: Record<AgentCategory | 'Other', React.ComponentType<{ className?: string }>> = {
  Core: Shield,
  Extended: Layers,
  Specialist: Wrench,
  Productivity: Briefcase,
  Professional: Star,
  Orchestration: GitMerge,
  Other: FolderOpen,
}

function CastV2Header({ agentCount }: { agentCount: number }) {
  const [dispatchExpanded, setDispatchExpanded] = useState(false)

  return (
    <div
      className="mb-6 rounded-xl overflow-hidden"
      style={{
        borderLeft: '3px solid var(--accent)',
        border: '1px solid rgba(0,255,194,0.15)',
        borderLeftWidth: '3px',
        background: 'rgba(0,255,194,0.03)',
      }}
    >
      {/* Always-visible header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-sm font-bold text-[var(--accent)]">CAST v2</span>
          <span className="text-xs text-[var(--text-muted)]">Hook-Enforced Dispatch</span>
        </div>
        <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
          <span>22 routes</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{agentCount} agents</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>2 model tiers</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>4 hooks</span>
        </div>
      </div>

      {/* Directive flow row */}
      <div className="px-5 pb-4 flex flex-col sm:flex-row gap-2">
        {[
          { directive: '[CAST-DISPATCH]', script: 'route.sh', target: 'specialist agent' },
          { directive: '[CAST-DISPATCH-GROUP]', script: 'route.sh', target: 'parallel agent group' },
          { directive: '[CAST-REVIEW]', script: 'post-tool-hook.sh', target: 'code-reviewer' },
          { directive: 'exit 2 block', script: 'pre-tool-guard.sh', target: 'blocks git commit' },
        ].map(({ directive, script, target }) => (
          <div
            key={directive}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs flex-1"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <span className="font-mono text-[var(--accent)] shrink-0">{directive}</span>
            <span className="text-[var(--text-muted)] shrink-0">→</span>
            <span className="font-mono text-[var(--text-secondary)] shrink-0">{script}</span>
            <span className="text-[var(--text-muted)] shrink-0">→</span>
            <span className="text-[var(--text-primary)] truncate">{target}</span>
          </div>
        ))}
      </div>

      {/* How dispatch works expandable */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setDispatchExpanded(!dispatchExpanded)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-[var(--bg-secondary)] transition-colors"
        >
          {dispatchExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
          <span className="text-xs font-medium text-[var(--text-secondary)]">How dispatch works</span>
          {!dispatchExpanded && (
            <span className="text-xs text-[var(--text-muted)] ml-1">Click to see the directive flow</span>
          )}
        </button>
        {dispatchExpanded && (
          <div className="px-5 pb-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              route.sh matches every prompt against 22 patterns. On match, it injects a [CAST-DISPATCH] directive
              into Claude's context. Claude sees it as a mandatory system instruction and dispatches the named agent immediately.
              For compound workflows, route.sh emits [CAST-DISPATCH-GROUP] instead — triggering one of 30 named parallel agent groups via wave-based dispatch.
              No slash command required. hard confidence = MANDATORY, soft confidence = RECOMMENDED.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentCard({ agent, isRouted, routeInfo, memoryCount }: { agent: AgentDefinition; isRouted: boolean; routeInfo?: { command: string; patternCount: number }; memoryCount: number }) {
  const modelStyle = getModelStyle(agent.model)

  return (
    <SpotlightCard className="bento-card hover-lift rounded-[var(--radius-card)]">
      <motion.div layoutId={`agent-card-${agent.name}`}>
        <Link
          to={`/agents/${agent.name}`}
          className="block p-5 no-underline"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
            <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">{agent.name}</h3>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${modelStyle.bg} ${modelStyle.text}`}>
              {agent.model}
            </span>
            {agent.tools.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                <Wrench className="w-3 h-3" /> {agent.tools.length} tools
              </span>
            )}
            {agent.memory === 'local' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                <Brain className="w-3 h-3" />
                {memoryCount > 0 && <span>{memoryCount}</span>}
              </span>
            )}
            {isRouted && routeInfo && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                <Route className="w-3 h-3" /> {routeInfo.command}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 m-0">{agent.description}</p>
        </Link>
      </motion.div>
    </SpotlightCard>
  )
}

function SkeletonCard() {
  return (
    <div className="bento-card p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-3 h-3 rounded-full bg-[var(--bg-tertiary)]" />
        <div className="h-5 w-32 bg-[var(--bg-tertiary)] rounded" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-5 w-16 bg-[var(--bg-tertiary)] rounded-full" />
        <div className="h-5 w-16 bg-[var(--bg-tertiary)] rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-[var(--bg-tertiary)] rounded" />
        <div className="h-4 w-3/4 bg-[var(--bg-tertiary)] rounded" />
      </div>
    </div>
  )
}

function CategorySection({
  category,
  agents,
  routingTable,
  routedAgents,
  memoryCountMap,
  colors,
  description,
}: {
  category: string
  agents: AgentDefinition[]
  routingTable: { routes: Array<{ agent: string; command: string; patternCount: number }> } | undefined
  routedAgents: Set<string>
  memoryCountMap: Map<string, number>
  colors: { border: string; text: string; bg: string }
  description: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [animateRef] = useAutoAnimate()
  const Icon = CATEGORY_ICONS[category as AgentCategory | 'Other'] ?? FolderOpen

  return (
    <div className={`rounded-xl border ${colors.border} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-[var(--bg-secondary)] transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
        <Icon className={`w-4 h-4 ${colors.text} shrink-0`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>{category}</span>
        <span className="text-xs text-[var(--text-muted)]">({agents.length})</span>
        <span className="text-xs text-[var(--text-muted)] ml-auto hidden sm:inline">{description}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div ref={animateRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const routeInfo = routingTable?.routes.find(r => r.agent === agent.name)
              return (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  isRouted={routedAgents.has(agent.name)}
                  routeInfo={routeInfo}
                  memoryCount={memoryCountMap.get(agent.name) ?? 0}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AgentsView() {
  const { data: agents, isLoading } = useAgents()
  const createAgent = useCreateAgent()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const { data: routingTable } = useRoutingTable()
  const { data: memoryFiles } = useAgentMemory()
  const routedAgents = new Set(routingTable?.routes.map(r => r.agent) ?? [])
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const memoryCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (memoryFiles) {
      for (const file of memoryFiles) {
        map.set(file.agent, (map.get(file.agent) ?? 0) + 1)
      }
    }
    return map
  }, [memoryFiles])

  const categorizedAgents = useMemo(() => {
    if (!agents) return null

    const groups: Record<string, AgentDefinition[]> = {}
    const allCategorized = new Set<string>()

    for (const [category, names] of Object.entries(AGENT_CATEGORIES)) {
      const matched = agents.filter(a => (names as readonly string[]).includes(a.name))
      if (matched.length > 0) {
        groups[category] = matched
        matched.forEach(a => allCategorized.add(a.name))
      }
    }

    const other = agents.filter(a => !allCategorized.has(a.name))
    if (other.length > 0) {
      groups['Other'] = other
    }

    return groups
  }, [agents])

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          {agents && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{agents.length} installed</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors shadow-md shadow-[#00FFC2]/20"
        >
          <Plus className="w-4 h-4" /> New Agent
        </button>
      </div>

      {/* CAST v2 Architecture Header */}
      <CastV2Header agentCount={agents?.length ?? 0} />

      {/* Create Agent Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bento-card p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Create New Agent</h2>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <AgentEditForm
              isCreate
              saving={createAgent.isPending}
              onSave={async (data) => {
                const result = await createAgent.mutateAsync(data as unknown as Parameters<typeof createAgent.mutateAsync>[0])
                setShowCreate(false)
                navigate(`/agents/${result.name}`)
              }}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-4">
          {categorizedAgents && Object.entries(categorizedAgents).map(([category, categoryAgents]) => {
            const colors = CATEGORY_COLORS[category as AgentCategory] ?? { border: 'border-gray-500/20', text: 'text-gray-400', bg: 'bg-gray-500/10' }
            const description = CATEGORY_DESCRIPTIONS[category as AgentCategory] ?? 'Agents not assigned to a standard category'
            return (
              <div key={category} ref={(el) => { categoryRefs.current[category] = el }}>
                <CategorySection
                  category={category}
                  agents={categoryAgents}
                  routingTable={routingTable}
                  routedAgents={routedAgents}
                  memoryCountMap={memoryCountMap}
                  colors={colors}
                  description={description}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
