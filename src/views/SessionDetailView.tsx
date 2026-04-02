import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '../api/useSessions'
import { timeAgo } from '../utils/time'
import { estimateCost, formatTokens, formatCost } from '../utils/costEstimate'
import CopyButton from '../components/CopyButton'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../components/ui/resizable'
import type { LogEntry, ContentBlock, TokenUsage } from '../types'

const TYPE_STYLES: Record<string, { dot: string; label: string; bg: string }> = {
  user: { dot: 'bg-blue-400', label: 'User', bg: 'bg-blue-500/10 border-blue-500/20' },
  assistant: { dot: 'bg-indigo-400', label: 'Assistant', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  tool_use: { dot: 'bg-amber-400', label: 'Tool Call', bg: 'bg-amber-500/10 border-amber-500/20' },
  tool_result: { dot: 'bg-emerald-400', label: 'Tool Result', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  progress: { dot: 'bg-gray-400', label: 'Progress', bg: 'bg-gray-500/10 border-gray-500/20' },
}

interface TimelineEntry {
  id: string
  type: 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'progress'
  timestamp: string
  content: string
  toolName?: string
  model?: string
  isSidechain?: boolean
}

function parseEntry(entry: LogEntry): TimelineEntry[] {
  const results: TimelineEntry[] = []
  const content = entry.message?.content
  const model = entry.message?.model

  if (entry.type === 'progress') {
    results.push({
      id: entry.uuid,
      type: 'progress',
      timestamp: entry.timestamp,
      content: entry.data?.type || 'Progress update',
      isSidechain: entry.isSidechain,
    })
    return results
  }

  if (typeof content === 'string') {
    results.push({
      id: entry.uuid,
      type: entry.message?.role === 'user' ? 'user' : 'assistant',
      timestamp: entry.timestamp,
      content,
      model,
      isSidechain: entry.isSidechain,
    })
    return results
  }

  if (Array.isArray(content)) {
    for (const block of content as ContentBlock[]) {
      if (block.type === 'text' && block.text) {
        results.push({
          id: `${entry.uuid}-text-${results.length}`,
          type: entry.message?.role === 'user' ? 'user' : 'assistant',
          timestamp: entry.timestamp,
          content: block.text,
          model,
          isSidechain: entry.isSidechain,
        })
      } else if (block.type === 'tool_use') {
        const inputStr = block.input ? JSON.stringify(block.input, null, 2) : ''
        results.push({
          id: block.id || `${entry.uuid}-tool-${results.length}`,
          type: 'tool_use',
          timestamp: entry.timestamp,
          content: inputStr,
          toolName: block.name,
          model,
          isSidechain: entry.isSidechain,
        })
      } else if (block.type === 'tool_result') {
        results.push({
          id: `${entry.uuid}-result-${results.length}`,
          type: 'tool_result',
          timestamp: entry.timestamp,
          content: typeof block.text === 'string' ? block.text : 'Result received',
          isSidechain: entry.isSidechain,
        })
      }
    }
  }

  if (results.length === 0) {
    results.push({
      id: entry.uuid,
      type: entry.message?.role === 'user' ? 'user' : 'assistant',
      timestamp: entry.timestamp,
      content: 'Activity',
      isSidechain: entry.isSidechain,
    })
  }

  return results
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const style = TYPE_STYLES[entry.type] || TYPE_STYLES.assistant

  return (
    <div className={`rounded-xl border px-5 py-4 ${style.bg} ${entry.isSidechain ? 'ml-6 opacity-80' : ''}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {style.label}
        </span>
        {entry.toolName && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-amber-300">
            {entry.toolName}
          </span>
        )}
        {entry.model && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            {entry.model}
          </span>
        )}
        {entry.isSidechain && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
            sidechain
          </span>
        )}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {timeAgo(entry.timestamp)}
        </span>
      </div>
      <div className="relative group/content">
        <pre className="text-sm text-[var(--text-primary)] whitespace-pre-wrap break-all font-mono leading-relaxed max-h-64 overflow-y-auto m-0 pr-8">
          {entry.content.length > 1000 ? entry.content.slice(0, 1000) + '...' : entry.content}
        </pre>
        <div className="absolute top-0 right-0 opacity-0 group-hover/content:opacity-100 transition-opacity">
          <CopyButton text={entry.content} />
        </div>
      </div>
    </div>
  )
}

// Compute token totals from entries
function computeTokens(entries: LogEntry[]) {
  let inputTokens = 0
  let outputTokens = 0
  let cacheCreation = 0
  let cacheRead = 0
  const modelCounts: Record<string, number> = {}

  for (const entry of entries) {
    const usage: TokenUsage | undefined = entry.message?.usage
    if (usage) {
      inputTokens += usage.input_tokens ?? 0
      outputTokens += usage.output_tokens ?? 0
      cacheCreation += usage.cache_creation_input_tokens ?? 0
      cacheRead += usage.cache_read_input_tokens ?? 0
    }
    if (entry.message?.model && entry.type === 'assistant') {
      modelCounts[entry.message.model] = (modelCounts[entry.message.model] ?? 0) + 1
    }
  }

  const dominantModel = Object.entries(modelCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || ''

  return { inputTokens, outputTokens, cacheCreation, cacheRead, dominantModel }
}

// Count tool usage from entries
function computeToolUsage(entries: LogEntry[]): Array<{ tool: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    if (Array.isArray(entry.message?.content)) {
      for (const block of entry.message!.content as ContentBlock[]) {
        if (block.type === 'tool_use' && block.name) {
          counts[block.name] = (counts[block.name] ?? 0) + 1
        }
      }
    }
  }
  return Object.entries(counts)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
}

export default function SessionDetailView() {
  const { project, sessionId } = useParams<{ project: string; sessionId: string }>()
  const { data: entries, isLoading, error } = useSession(project || '', sessionId || '')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-24 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--bg-tertiary)]" />
                <div className="h-4 w-20 bg-[var(--bg-tertiary)] rounded" />
              </div>
              <div className="h-4 w-3/4 bg-[var(--bg-tertiary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || !entries || entries.length === 0) {
    return (
      <div className="space-y-6">
        <Link to="/sessions" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors no-underline">
          <ArrowLeft className="w-4 h-4" /> Back to Sessions
        </Link>
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--error)]/30 px-5 py-4 text-sm text-[var(--error)]">
          Session not found
        </div>
      </div>
    )
  }

  // Parse all entries into timeline items
  const timeline = entries.flatMap(parseEntry)

  // Extract metadata from first entry
  const firstEntry = entries[0]
  const lastEntry = entries[entries.length - 1]
  const projectName = project ? decodeURIComponent(project).split('/').pop() : 'Unknown'

  // Count stats
  const userMessages = entries.filter(e => e.message?.role === 'user').length
  const assistantMessages = entries.filter(e => e.message?.role === 'assistant').length
  const toolCalls = entries.reduce((count, e) => {
    if (!Array.isArray(e.message?.content)) return count
    return count + (e.message!.content as ContentBlock[]).filter(b => b.type === 'tool_use').length
  }, 0)

  // Token and cost analytics
  const tokens = computeTokens(entries)
  const totalTokens = tokens.inputTokens + tokens.outputTokens
  const cost = estimateCost(tokens.inputTokens, tokens.outputTokens, tokens.cacheCreation, tokens.cacheRead, tokens.dominantModel)
  const toolUsage = computeToolUsage(entries)

  // Export handler
  async function handleExport() {
    try {
      const res = await fetch(`/api/sessions/${project}/${sessionId}/export`)
      const data = await res.json()
      const blob = new Blob([data.body], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId?.slice(0, 8)}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed — try again')
    }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link to="/sessions" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors no-underline">
          <ArrowLeft className="w-4 h-4" /> Back to Sessions
        </Link>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export MD
        </button>
      </div>

      {/* Session header */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{projectName}</h1>
        <div className="flex items-center gap-1 mb-4">
          <p className="text-xs font-mono text-[var(--text-muted)]">{sessionId}</p>
          <CopyButton text={sessionId || ''} size={12} />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-[var(--text-muted)]">Started: </span>
            <span className="text-[var(--text-secondary)]">{timeAgo(firstEntry?.timestamp)}</span>
          </div>
          {lastEntry && (
            <div>
              <span className="text-[var(--text-muted)]">Last activity: </span>
              <span className="text-[var(--text-secondary)]">{timeAgo(lastEntry.timestamp)}</span>
            </div>
          )}
          {firstEntry?.gitBranch && (
            <div>
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">
                {firstEntry.gitBranch}
              </span>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-[var(--border)]">
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{userMessages}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">user</span>
          </div>
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{assistantMessages}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">assistant</span>
          </div>
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{toolCalls}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">tool calls</span>
          </div>
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{entries.length}</span>
            <span className="text-xs text-[var(--text-muted)] ml-1.5">entries</span>
          </div>
        </div>
      </div>

      {/* Resizable panels: Timeline (left) + Token/Tool Usage (right) */}
      <div className="min-h-[500px]">
        <ResizablePanelGroup {...({ direction: 'horizontal', className: 'rounded-xl' } as any)}>
          {/* Left panel: Timeline */}
          <ResizablePanel defaultSize={65} minSize={40}>
            <div className="space-y-3 pr-2 h-full overflow-y-auto">
              {timeline.map((item) => (
                <TimelineCard key={item.id} entry={item} />
              ))}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="mx-1 bg-[var(--border)] data-[resize-handle-state=hover]:bg-[var(--accent)]/40 data-[resize-handle-state=drag]:bg-[var(--accent)] transition-colors [&>div]:bg-[var(--accent)]" />

          {/* Right panel: Token Usage + Tool Usage */}
          <ResizablePanel defaultSize={35} minSize={20}>
            <div className="space-y-4 pl-2 h-full overflow-y-auto">
              {/* Token Usage Summary */}
              {totalTokens > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Token Usage</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="text-lg font-bold text-[var(--accent)] tabular-nums">{formatTokens(tokens.inputTokens)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Input</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(tokens.outputTokens)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Output</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="text-lg font-bold text-[var(--text-secondary)] tabular-nums">{formatTokens(tokens.cacheCreation)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Cache Write</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="text-lg font-bold text-[var(--text-secondary)] tabular-nums">{formatTokens(tokens.cacheRead)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Cache Read</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                      <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{formatTokens(totalTokens)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Total</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
                      <div className="text-lg font-bold text-[var(--accent)] tabular-nums">{formatCost(cost)}</div>
                      <div className="text-xs text-[var(--text-muted)]">Est. Cost</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tool Usage Breakdown */}
              {toolUsage.length > 0 && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">Tool Usage</h2>
                  <div className="grid grid-cols-1 gap-2">
                    {(() => {
                      const maxCount = toolUsage[0]?.count ?? 1
                      return toolUsage.map(({ tool, count }) => (
                      <div key={tool} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                        <span className="text-sm font-mono text-[var(--text-primary)]">{tool}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{ width: `${Math.min(100, (count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--text-muted)] tabular-nums w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
