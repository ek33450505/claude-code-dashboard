import { useState, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Wrench, Plus, X, Cpu, Zap, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useAgents } from '../api/useAgents'
import { useCreateAgent } from '../api/useAgentMutations'
import { useAgentMemory } from '../api/useMemory'
import { useSystemHealth } from '../api/useSystem'
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

const CATEGORY_ICONS: Record<AgentCategory | 'Uncategorized', React.ComponentType<{ className?: string }>> = {
  Sonnet: Cpu,
  Haiku: Zap,
  Uncategorized: FolderOpen,
}

function CastV3Header({ agentCount, hookCount }: { agentCount: number; hookCount: number }) {
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
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-sm font-bold text-[var(--accent)]">CAST v3</span>
          <span className="text-xs text-[var(--text-muted)]">Model-Driven Dispatch</span>
        </div>
        <div className="text-xs text-[var(--text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
          <span>{agentCount} agents</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>2 model tiers</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span>{hookCount} hooks</span>
        </div>
      </div>

      <div className="px-5 pb-4 flex flex-col sm:flex-row gap-2">
        {[
          { label: 'CLAUDE.md', description: 'Dispatch table — model reads and decides' },
          { label: 'post-tool-hook.sh', description: 'Injects [CAST-REVIEW] after code changes' },
          { label: 'pre-tool-guard.sh', description: 'Blocks raw git commit/push' },
          { label: 'cast-cost-tracker.sh', description: 'Logs every agent dispatch to cast.db' },
        ].map(({ label, description }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs flex-1"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <span className="font-mono text-[var(--accent)] shrink-0">{label}</span>
            <span className="text-[var(--text-muted)] shrink-0">→</span>
            <span className="text-[var(--text-primary)] truncate">{description}</span>
          </div>
        ))}
      </div>

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
            <span className="text-xs text-[var(--text-muted)] ml-1">Click to see the dispatch flow</span>
          )}
        </button>
        {dispatchExpanded && (
          <div className="px-5 pb-4">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              CLAUDE.md contains a 15-row dispatch table. When a prompt arrives, the model reads the table and decides
              which agent to call via the Agent tool. No routing scripts, no regex matching — the model is the router.
              After code changes, the post-chain protocol fires: code-reviewer → commit → push.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function AgentCard({ agent, memoryCount }: { agent: AgentDefinition; memoryCount: number }) {
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
  memoryCountMap,
  colors,
  description,
}: {
  category: string
  agents: AgentDefinition[]
  memoryCountMap: Map<string, number>
  colors: { border: string; text: string; bg: string }
  description: string
}) {
  const [expanded, setExpanded] = useState(true)
  const [animateRef] = useAutoAnimate()
  const Icon = CATEGORY_ICONS[category as AgentCategory | 'Uncategorized'] ?? FolderOpen

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
            {agents.map((agent) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                memoryCount={memoryCountMap.get(agent.name) ?? 0}
              />
            ))}
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
  const { data: memoryFiles } = useAgentMemory()
  const { data: health } = useSystemHealth()
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
      groups['Uncategorized'] = other
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

      {/* CAST v3 Architecture Header */}
      <CastV3Header
        agentCount={agents?.length ?? 0}
        hookCount={health?.hooks.length ?? 0}
      />

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
            const description = CATEGORY_DESCRIPTIONS[category as AgentCategory] ?? 'Agents not yet assigned to a category — update agentCategories.ts to fix'
            return (
              <div key={category} ref={(el) => { categoryRefs.current[category] = el }}>
                <CategorySection
                  category={category}
                  agents={categoryAgents}
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
