import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, FileText, Terminal, Search, Wrench, ArrowRight, CheckSquare } from 'lucide-react'
import type { SessionAgentRun, AgentDetailTab, ParsedWorkLog } from '../../types'
import type { ToolEvent } from './AgentCard'
import StatusPill from './StatusPill'
import type { AgentStatus } from './StatusPill'
import WorkLogSection from './WorkLogSection'
import { getBadgeColor } from './agentColors'

function formatDuration(ms: number | null): string {
  if (ms === null) return 'running...'
  if (ms < 1000) return '<1s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function mapStatus(s: string): AgentStatus {
  const normalized = s.toUpperCase().replace(/ /g, '_')
  if (normalized === 'DONE') return 'DONE'
  if (normalized === 'DONE_WITH_CONCERNS') return 'DONE_WITH_CONCERNS'
  if (normalized === 'BLOCKED' || normalized === 'FAILED') return 'BLOCKED'
  if (normalized === 'NEEDS_CONTEXT') return 'NEEDS_CONTEXT'
  if (normalized === 'RUNNING') return 'running'
  return 'stale'
}

interface Props {
  agent: SessionAgentRun
  toolEvents?: ToolEvent[]
  workLog?: ParsedWorkLog | null
  currentActivity?: string
  onClose: () => void
}

const TABS: { key: AgentDetailTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tools', label: 'Tool Feed' },
  { key: 'worklog', label: 'Work Log' },
  { key: 'files', label: 'Files' },
]

const toolIcons: Record<string, React.ReactNode> = {
  Read:      <FileText size={10} className="flex-shrink-0 text-sky-400/70" />,
  Write:     <FileText size={10} className="flex-shrink-0 text-emerald-400/70" />,
  Edit:      <FileText size={10} className="flex-shrink-0 text-amber-400/70" />,
  Bash:      <Terminal size={10} className="flex-shrink-0 text-orange-400/70" />,
  Grep:      <Search size={10} className="flex-shrink-0 text-purple-400/70" />,
  Glob:      <Search size={10} className="flex-shrink-0 text-purple-400/70" />,
  Agent:     <ArrowRight size={10} className="flex-shrink-0 text-blue-400/70" />,
  TodoWrite: <CheckSquare size={10} className="flex-shrink-0 text-teal-400/70" />,
}

export default function AgentDetailPanel({ agent, toolEvents = [], workLog, currentActivity, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<AgentDetailTab>('overview')

  const status = mapStatus(agent.status)

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="rounded-lg border border-border bg-card/60 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${getBadgeColor(agent.agent)}`}>
          {agent.agent}
        </span>
        <StatusPill status={status} />
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {formatDuration(agent.duration_ms)}
        </span>
        {agent.cost_usd > 0 && (
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            ${agent.cost_usd.toFixed(3)}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
        >
          <X size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[11px] font-mono transition-colors ${
              activeTab === tab.key
                ? 'text-foreground border-b-2 border-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-3 max-h-80 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-3">
            {/* Current activity */}
            {currentActivity && (
              <div className="text-xs font-mono text-blue-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {currentActivity}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatItem label="Status" value={agent.status} />
              <StatItem label="Model" value={agent.model || '--'} />
              <StatItem label="Duration" value={formatDuration(agent.duration_ms)} />
              <StatItem label="Cost" value={agent.cost_usd > 0 ? `$${agent.cost_usd.toFixed(3)}` : '--'} />
              <StatItem label="Tokens In" value={formatTokens(agent.input_tokens)} />
              <StatItem label="Tokens Out" value={formatTokens(agent.output_tokens)} />
              <StatItem label="Started" value={new Date(agent.started_at).toLocaleTimeString()} />
              {agent.ended_at && (
                <StatItem label="Ended" value={new Date(agent.ended_at).toLocaleTimeString()} />
              )}
            </div>

            {/* Worktree info */}
            {agent.worktree_branch && (
              <div className="flex items-center gap-2 text-xs font-mono text-green-400/80">
                <span>&#x1f333;</span>
                <span>Worktree: {agent.worktree_branch}</span>
              </div>
            )}

            {/* Task summary */}
            {agent.task_summary && (
              <div className="text-xs text-muted-foreground border-l-2 border-border/60 pl-2 italic">
                {agent.task_summary}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="flex flex-col gap-px">
            {toolEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono">No tool calls recorded</p>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground/50 font-mono mb-2">
                  {toolEvents.length} tool call{toolEvents.length !== 1 ? 's' : ''}
                </p>
                {toolEvents.map(ev => {
                  const icon = toolIcons[ev.toolName] ?? <Wrench size={10} className="flex-shrink-0 opacity-40" />
                  const ts = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
                  return (
                    <div key={ev.id} className="flex items-start gap-1.5 text-[10px] text-muted-foreground font-mono leading-snug py-1 border-b border-border/10 last:border-0">
                      <span className="mt-0.5 flex-shrink-0">{icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="text-foreground/60 font-semibold">{ev.toolName}</span>
                        {ev.inputPreview && (
                          <span className="text-muted-foreground/80 break-all ml-1">{ev.inputPreview}</span>
                        )}
                      </span>
                      {ts && <span className="flex-shrink-0 text-muted-foreground/30 tabular-nums">{ts}</span>}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'worklog' && (
          <div>
            {workLog ? (
              <WorkLogSection workLog={workLog} />
            ) : (
              <p className="text-xs text-muted-foreground font-mono">No work log available</p>
            )}
          </div>
        )}

        {activeTab === 'files' && (
          <div className="flex flex-col gap-1">
            {workLog && (workLog.filesRead.length > 0 || workLog.filesChanged.length > 0) ? (
              <>
                {workLog.filesChanged.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground/50 font-mono mb-1 uppercase tracking-wider">Changed</p>
                    {workLog.filesChanged.map((f, i) => (
                      <div key={i} className="text-xs font-mono text-amber-400/80 py-0.5">{f}</div>
                    ))}
                  </div>
                )}
                {workLog.filesRead.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground/50 font-mono mb-1 uppercase tracking-wider">Read</p>
                    {workLog.filesRead.map((f, i) => (
                      <div key={i} className="text-xs font-mono text-sky-400/60 py-0.5">{f}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground font-mono">No file information available</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-wider">{label}</span>
      <span className="text-xs text-foreground font-mono">{value}</span>
    </div>
  )
}
