import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, Brain, Wrench, Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAgent } from '../api/useAgents'
import { useUpdateAgent } from '../api/useAgentMutations'
import { getAgentCategory } from '../utils/agentCategories'
import AgentEditForm from '../components/AgentEditForm'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable'

const MODEL_COLORS: Record<string, { bg: string; text: string }> = {
  sonnet: { bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
  haiku: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  opus: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
}

function getModelStyle(model: string) {
  return MODEL_COLORS[model] ?? { bg: 'bg-[var(--bg-tertiary)]', text: 'text-[var(--text-secondary)]' }
}

export default function AgentDetailView() {
  const { name } = useParams<{ name: string }>()
  const { data: agent, isLoading, error } = useAgent(name || '')
  const updateAgent = useUpdateAgent(name || '')
  const [editing, setEditing] = useState(false)

  const agentCategory = name ? getAgentCategory(name) : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        <div className="bento-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
            <div className="h-7 w-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-[var(--bg-tertiary)] rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-[var(--bg-tertiary)] rounded-full animate-pulse" />
          </div>
          <div className="space-y-2 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-[var(--bg-tertiary)] rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Link to="/agents" className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline">
          <ArrowLeft className="w-4 h-4" /> Back to Agents
        </Link>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Agent not found
        </div>
      </div>
    )
  }

  const modelStyle = getModelStyle(agent.model)

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in">
      {/* Back link */}
      <Link to="/agents" className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors no-underline">
        <ArrowLeft className="w-4 h-4" /> Back to Agents
      </Link>

      {/* Header card with layoutId for shared element transition */}
      <motion.div layoutId={`agent-card-${name}`} className="bento-card p-6">
        {editing ? (
          <AgentEditForm
            agent={agent}
            saving={updateAgent.isPending}
            onSave={async (data) => {
              await updateAgent.mutateAsync(data as Parameters<typeof updateAgent.mutateAsync>[0])
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            {/* Name + color dot + edit button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">{agent.name}</h1>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${modelStyle.bg} ${modelStyle.text}`}>
                {agent.model}
              </span>
              {agent.memory === 'local' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                  <Brain className="w-3 h-3" /> Local Memory
                </span>
              )}
              {agent.maxTurns > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                  {agent.maxTurns} max turns
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-[var(--text-secondary)] mb-0">{agent.description}</p>
          </>
        )}
      </motion.div>

      {/* Resizable panels: metadata (left) + definition (right) */}
      <ResizablePanelGroup {...({ direction: 'horizontal', className: 'min-h-[500px] rounded-xl' } as any)}>
        {/* Left panel: metadata */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="bento-card p-6 h-full overflow-y-auto">
            {/* Tools list */}
            {Array.isArray(agent.tools) && agent.tools.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Tools ({agent.tools.length})
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tools.map((tool) => (
                    <span key={tool} className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Disallowed tools */}
            {Array.isArray(agent.disallowedTools) && agent.disallowedTools.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Disallowed Tools
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {agent.disallowedTools.map((tool) => (
                    <span key={tool} className="inline-block px-2 py-0.5 text-xs rounded bg-red-500/10 text-red-400 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dispatch info */}
            {agentCategory && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Dispatch
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-[var(--text-muted)] mr-2">Model tier:</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                      {agentCategory}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Dispatched via CLAUDE.md model-driven routing
                  </p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="bg-[var(--glass-border)] hover:bg-[var(--accent)]/30 transition-colors" />

        {/* Right panel: agent definition markdown */}
        <ResizablePanel defaultSize={45} minSize={25}>
          <div className="bento-card p-6 h-full overflow-y-auto">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Agent Definition
            </h2>
            <div className="prose prose-invert prose-sm max-w-none text-[var(--text-secondary)]
              [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-[var(--text-primary)] [&_h1]:mt-6 [&_h1]:mb-2
              [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--text-primary)] [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[var(--text-primary)] [&_h3]:mt-4 [&_h3]:mb-1
              [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-3
              [&_ul]:text-sm [&_ul]:mb-3 [&_ul]:pl-5
              [&_li]:mb-1
              [&_code]:font-mono [&_code]:text-[var(--accent)] [&_code]:text-xs [&_code]:bg-[var(--bg-primary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
              [&_pre]:bg-[var(--bg-primary)] [&_pre]:border [&_pre]:border-[var(--glass-border)] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto
              [&_pre_code]:bg-transparent [&_pre_code]:p-0
              [&_strong]:text-[var(--text-primary)]
            ">
              <ReactMarkdown>{agent.body}</ReactMarkdown>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
