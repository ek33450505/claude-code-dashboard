import { useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { Brain, Scale, Map, Settings, FileOutput, Sparkles, Terminal, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { usePlans } from '../api/usePlans'
import { useProjectMemory, useAgentMemory } from '../api/useMemory'
import { useOutputs } from '../api/useOutputs'
import { useRules, useSkills, useCommands } from '../api/useKnowledge'
import { useConfig } from '../api/useSystem'
import { timeAgo } from '../utils/time'
import FileViewer from '../components/FileViewer'
import type { PlanFile, MemoryFile, OutputFile } from '../types'

// --- Category Card ---

interface CategoryCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function CategoryCard({ icon: Icon, title, count, isExpanded, onToggle, children }: CategoryCardProps) {
  return (
    <div className={`bento-card overflow-hidden transition-all duration-300 ${isExpanded ? 'col-span-full' : ''}`}>
      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)]/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-subtle)]">
            <Icon className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--text-muted)]">{count} {count === 1 ? 'file' : 'files'}</p>
          </div>
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-[var(--border)] pt-4 animate-in">
          {children}
        </div>
      )}
    </div>
  )
}

// --- File list item ---

function FileItem({ name, subtitle, onClick }: { name: string, subtitle?: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)] font-mono truncate block">{name}</span>
          {subtitle && <span className="text-xs text-[var(--text-muted)]">{subtitle}</span>}
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </button>
  )
}

// --- Memory subcategory helpers ---

function typeBadgeColor(type?: string): string {
  switch (type) {
    case 'user': return 'bg-[var(--accent)]/20 text-[var(--accent)]'
    case 'feedback': return 'bg-[var(--warning)]/20 text-[var(--warning)]'
    case 'project': return 'bg-[var(--success)]/20 text-[var(--success)]'
    case 'reference': return 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'
    default: return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
  }
}

function MemoryItem({ file, onView }: { file: MemoryFile, onView: (title: string, body: string) => void }) {
  return (
    <button
      onClick={() => onView(file.name || file.path.split('/').pop() || '', file.body)}
      className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-[var(--text-primary)] font-mono truncate block">
            {file.name || file.path.split('/').pop()}
          </span>
          {file.description && <span className="text-xs text-[var(--text-muted)] line-clamp-1">{file.description}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {file.type && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeBadgeColor(file.type)}`}>
              {file.type}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// --- Group utility ---
function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of arr) {
    const key = keyFn(item)
    if (!result[key]) result[key] = []
    result[key].push(item)
  }
  return result
}

// --- Main Knowledge View ---

export default function KnowledgeView() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [viewerContent, setViewerContent] = useState<{ title: string; body: string } | null>(null)

  // Data hooks
  const { data: plans } = usePlans()
  const { data: projectMemory } = useProjectMemory()
  const { data: agentMemory } = useAgentMemory()
  const { data: rules } = useRules()
  const { data: skills } = useSkills()
  const { data: commands } = useCommands()
  const { data: briefings } = useOutputs('briefings')
  const { data: meetings } = useOutputs('meetings')
  const { data: reports } = useOutputs('reports')
  const { data: config } = useConfig()

  const memoryCount = (projectMemory?.length || 0) + (agentMemory?.length || 0) + (config ? 1 : 0)
  const outputCount = (briefings?.length || 0) + (meetings?.length || 0) + (reports?.length || 0)

  function toggle(id: string) {
    setExpandedCategory(prev => prev === id ? null : id)
  }

  function openViewer(title: string, body: string) {
    setViewerContent({ title, body })
  }

  async function fetchAndView(url: string, title: string) {
    try {
      const res = await fetch(url)
      const data = await res.json()
      openViewer(title, data.body)
    } catch {
      openViewer(title, 'Failed to load file content.')
    }
  }

  const groupedProjectMem = projectMemory ? groupBy(projectMemory, m => m.agent) : {}
  const groupedAgentMem = agentMemory ? groupBy(agentMemory, m => m.agent) : {}

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Browse all local Claude Code configuration and outputs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Memory */}
        <CategoryCard
          icon={Brain}
          title="Memory"
          count={memoryCount}
          isExpanded={expandedCategory === 'memory'}
          onToggle={() => toggle('memory')}
        >
          <div className="space-y-4">
            {/* CLAUDE.md */}
            {config && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Global Config</h4>
                <FileItem name="CLAUDE.md" subtitle="Global instructions" onClick={() => openViewer('CLAUDE.md', (config as Record<string, string>).claudeMd || '')} />
              </div>
            )}
            {/* Project Memory */}
            {Object.entries(groupedProjectMem).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Project Memory</h4>
                <div className="grid gap-2">
                  {Object.entries(groupedProjectMem).map(([project, files]) => (
                    <div key={project}>
                      <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">{project}</p>
                      <div className="grid gap-1.5">
                        {files.map((file: MemoryFile) => (
                          <MemoryItem key={file.path} file={file} onView={openViewer} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Agent Memory */}
            {Object.entries(groupedAgentMem).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Agent Memory</h4>
                <div className="grid gap-2">
                  {Object.entries(groupedAgentMem).map(([agent, files]) => (
                    <div key={agent}>
                      <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">{agent}</p>
                      <div className="grid gap-1.5">
                        {files.map((file: MemoryFile) => (
                          <MemoryItem key={file.path} file={file} onView={openViewer} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CategoryCard>

        {/* Rules */}
        <CategoryCard
          icon={Scale}
          title="Rules"
          count={rules?.length || 0}
          isExpanded={expandedCategory === 'rules'}
          onToggle={() => toggle('rules')}
        >
          <div className="grid gap-2">
            {rules?.map(rule => (
              <FileItem
                key={rule.filename}
                name={rule.filename}
                subtitle={rule.preview.slice(0, 80)}
                onClick={() => fetchAndView(`/api/rules/${encodeURIComponent(rule.filename)}`, rule.filename)}
              />
            ))}
          </div>
        </CategoryCard>

        {/* Plans */}
        <CategoryCard
          icon={Map}
          title="Plans"
          count={plans?.length || 0}
          isExpanded={expandedCategory === 'plans'}
          onToggle={() => toggle('plans')}
        >
          <div className="grid gap-2">
            {plans?.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()).map((plan: PlanFile) => (
              <Link
                key={plan.filename}
                to={`/knowledge/plans/${encodeURIComponent(plan.filename)}`}
                className="block px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors no-underline group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                      {plan.title || plan.filename}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{timeAgo(plan.modifiedAt)}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </CategoryCard>

        {/* Skills */}
        <CategoryCard
          icon={Sparkles}
          title="Skills"
          count={skills?.length || 0}
          isExpanded={expandedCategory === 'skills'}
          onToggle={() => toggle('skills')}
        >
          <div className="grid gap-2">
            {skills?.map(skill => (
              <FileItem
                key={skill.name}
                name={skill.name}
                subtitle={skill.description.slice(0, 80)}
                onClick={() => fetchAndView(`/api/skills/${encodeURIComponent(skill.name)}`, `${skill.name}/SKILL.md`)}
              />
            ))}
          </div>
        </CategoryCard>

        {/* Commands */}
        <CategoryCard
          icon={Terminal}
          title="Commands"
          count={commands?.length || 0}
          isExpanded={expandedCategory === 'commands'}
          onToggle={() => toggle('commands')}
        >
          <div className="grid gap-2">
            {commands?.map(cmd => (
              <FileItem
                key={cmd.name}
                name={`/${cmd.name}`}
                subtitle={cmd.preview}
                onClick={() => fetchAndView(`/api/commands/${encodeURIComponent(cmd.name)}`, `/${cmd.name}`)}
              />
            ))}
          </div>
        </CategoryCard>

        {/* Settings */}
        <CategoryCard
          icon={Settings}
          title="Settings"
          count={2}
          isExpanded={expandedCategory === 'settings'}
          onToggle={() => toggle('settings')}
        >
          <div className="grid gap-2">
            <FileItem
              name="settings.json"
              subtitle="Global Claude Code settings"
              onClick={() => fetchAndView('/api/config/settings', 'settings.json')}
            />
            <FileItem
              name="settings.local.json"
              subtitle="Local overrides, hooks, permissions"
              onClick={() => fetchAndView('/api/config/settings-local', 'settings.local.json')}
            />
          </div>
        </CategoryCard>

        {/* Outputs */}
        <CategoryCard
          icon={FileOutput}
          title="Outputs"
          count={outputCount}
          isExpanded={expandedCategory === 'outputs'}
          onToggle={() => toggle('outputs')}
        >
          <div className="space-y-4">
            {briefings && briefings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Briefings</h4>
                <div className="grid gap-2">
                  {briefings.map((o: OutputFile) => (
                    <FileItem key={o.path} name={o.filename} subtitle={timeAgo(o.modifiedAt)} onClick={() => openViewer(o.filename, o.preview)} />
                  ))}
                </div>
              </div>
            )}
            {meetings && meetings.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Meetings</h4>
                <div className="grid gap-2">
                  {meetings.map((o: OutputFile) => (
                    <FileItem key={o.path} name={o.filename} subtitle={timeAgo(o.modifiedAt)} onClick={() => openViewer(o.filename, o.preview)} />
                  ))}
                </div>
              </div>
            )}
            {reports && reports.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Reports</h4>
                <div className="grid gap-2">
                  {reports.map((o: OutputFile) => (
                    <FileItem key={o.path} name={o.filename} subtitle={timeAgo(o.modifiedAt)} onClick={() => openViewer(o.filename, o.preview)} />
                  ))}
                </div>
              </div>
            )}
            {outputCount === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-4">No outputs found</p>}
          </div>
        </CategoryCard>
      </div>

      {/* File Viewer Modal */}
      <FileViewer
        title={viewerContent?.title || ''}
        content={viewerContent?.body || ''}
        isOpen={!!viewerContent}
        onClose={() => setViewerContent(null)}
      />
    </div>
  )
}
