import { useState, useMemo } from 'react'
import type { SessionAgentRun } from '../../types'
import StatusPill from './StatusPill'
import type { AgentStatus } from './StatusPill'
import { getBadgeColor } from './agentColors'
import { formatDuration } from '../../utils/time'
import { formatCost } from '../../utils/costEstimate'

function modelPill(model: string): { label: string; className: string } | null {
  if (!model) return null
  if (model.includes('haiku')) return { label: 'Haiku', className: 'bg-cyan-500/15 text-cyan-400' }
  if (model.includes('opus')) return { label: 'Opus', className: 'bg-amber-500/15 text-amber-400' }
  if (model.includes('sonnet')) return { label: 'Sonnet', className: 'bg-purple-500/15 text-purple-400' }
  return null
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

type SortKey = 'agent' | 'model' | 'status' | 'duration' | 'cost' | 'started_at'

interface Props {
  runs: SessionAgentRun[]
  onSelectAgent?: (run: SessionAgentRun) => void
  compact?: boolean
}

export default function SessionHistoryTable({ runs, onSelectAgent, compact = false }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('started_at')
  const [sortAsc, setSortAsc] = useState(true)

  const sorted = useMemo(() => {
    const arr = [...runs]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'agent': cmp = a.agent.localeCompare(b.agent); break
        case 'model': cmp = (a.model ?? '').localeCompare(b.model ?? ''); break
        case 'status': cmp = a.status.localeCompare(b.status); break
        case 'duration': cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0); break
        case 'cost': cmp = a.cost_usd - b.cost_usd; break
        case 'started_at': cmp = new Date(a.started_at).getTime() - new Date(b.started_at).getTime(); break
      }
      return sortAsc ? cmp : -cmp
    })
    return arr
  }, [runs, sortKey, sortAsc])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(prev => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground font-mono">
        No agent runs yet
      </div>
    )
  }

  const headerClass = 'px-3 py-2 text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none text-left'
  const sortIndicator = (key: SortKey) => sortKey === key ? (sortAsc ? ' ^' : ' v') : ''

  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className={headerClass} onClick={() => handleSort('agent')}>Agent{sortIndicator('agent')}</th>
              {!compact && <th className={headerClass} onClick={() => handleSort('model')}>Model{sortIndicator('model')}</th>}
              <th className={headerClass} onClick={() => handleSort('status')}>Status{sortIndicator('status')}</th>
              <th className={headerClass} onClick={() => handleSort('duration')}>Duration{sortIndicator('duration')}</th>
              <th className={headerClass} onClick={() => handleSort('cost')}>Cost{sortIndicator('cost')}</th>
              {!compact && <th className={`${headerClass} hidden sm:table-cell`}>Worktree</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map(run => {
              const model = modelPill(run.model)
              return (
                <tr
                  key={run.id}
                  onClick={() => onSelectAgent?.(run)}
                  className={`hover:bg-accent/10 transition-colors ${onSelectAgent ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${getBadgeColor(run.agent)}`}>
                      {run.agent}
                    </span>
                  </td>
                  {!compact && (
                    <td className="px-3 py-2">
                      {model && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${model.className}`}>
                          {model.label}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <StatusPill status={mapStatus(run.status)} />
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground tabular-nums">
                    {formatCost(run.cost_usd)}
                  </td>
                  {!compact && (
                    <td className="px-3 py-2 hidden sm:table-cell font-mono text-muted-foreground">
                      {run.worktree_branch ? (
                        <span className="inline-flex items-center gap-1 text-green-400/80">
                          <span>&#x1f333;</span>
                          <span className="text-[10px]">{run.worktree_branch.slice(-8)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">--</span>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
