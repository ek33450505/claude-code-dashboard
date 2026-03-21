import {
  Users, Terminal, Zap, History,
  FileText, Shield, Brain, Database, Route
} from 'lucide-react'
import { useSystemHealth } from '../api/useSystem'
import { useRoutingStats } from '../api/useRouting'
import StatCard, { StatCardSkeleton } from '../components/StatCard'
import CopyButton from '../components/CopyButton'

export default function SystemView() {
  const { data: health, isLoading } = useSystemHealth()
  const { data: routing } = useRoutingStats()

  const statRows = health
    ? [
        [
          { label: 'Agents', value: health.agentCount, icon: <Users className="w-5 h-5" /> },
          { label: 'Commands', value: health.commandCount, icon: <Terminal className="w-5 h-5" /> },
          { label: 'Skills', value: health.skillCount, icon: <Zap className="w-5 h-5" /> },
          { label: 'Sessions', value: health.sessionCount, icon: <History className="w-5 h-5" /> },
        ],
        [
          { label: 'Plans', value: health.planCount, icon: <FileText className="w-5 h-5" /> },
          { label: 'Rules', value: health.ruleCount, icon: <Shield className="w-5 h-5" /> },
          { label: 'Project Memories', value: health.projectMemoryCount, icon: <Brain className="w-5 h-5" /> },
          { label: 'Agent Memories', value: health.agentMemoryCount, icon: <Database className="w-5 h-5" /> },
        ],
      ]
    : []

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">System Overview</h1>

      {/* Stat cards */}
      {isLoading ? (
        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {statRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {row.map((stat) => (
                <StatCard key={stat.label} {...stat} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Active Hooks */}
      {health && health.hooks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Active Hooks</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <th className="text-left px-4 py-3 font-medium">Event</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Matcher</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {health.hooks.map((hook, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--accent)]/20 text-[var(--accent-hover)]">
                        {hook.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{hook.type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        {hook.matcher ?? '\u2014'}
                        {hook.matcher && <CopyButton text={hook.matcher} size={12} />}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {hook.description ?? '\u2014'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Agent Routing Stats */}
      {routing && routing.totalEvents > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Route className="w-4 h-4 text-[var(--accent)]" />
              Agent Routing
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Auto-dispatch active
            </span>
          </div>

          {/* 4 stat boxes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{routing.totalEvents}</div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Prompts Seen</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[var(--accent)]">{routing.routedCount}</div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Dispatched</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {(routing.routingRate * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Coverage Rate</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${(1 - routing.routingRate) > 0.2 ? 'text-amber-400' : 'text-[var(--text-primary)]'}`}>
                {((1 - routing.routingRate) * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-[var(--text-secondary)] mt-1">Miss Rate</div>
              {(1 - routing.routingRate) > 0.2 && (
                <div className="text-[10px] text-amber-400 mt-1">Router agent activates at &gt;20%</div>
              )}
            </div>
          </div>

          {/* Top agents + recent events side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {routing.topAgents.length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Top Dispatched Agents</h3>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {routing.topAgents.map(({ agent, count }, i) => {
                      const maxCount = routing.topAgents[0]?.count ?? 1
                      const pct = Math.round((count / maxCount) * 100)
                      return (
                        <tr key={agent} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="px-4 py-2.5 w-6 text-xs text-[var(--text-muted)] tabular-nums">{i + 1}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-[var(--text-primary)]">{agent}</span>
                            </div>
                            <div className="mt-1 h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-[var(--accent)] font-semibold tabular-nums text-sm">{count}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Recent routing events feed */}
            {routing.recentEvents?.length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)]">Recent Routing Events</h3>
                </div>
                <div className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
                  {routing.recentEvents.slice(0, 10).map((ev, i) => {
                    const actionStyles: Record<string, string> = {
                      dispatched: 'bg-[var(--accent)]/15 text-[var(--accent)]',
                      suggested: 'bg-[var(--accent)]/10 text-[var(--accent)]/70',
                      no_match: 'bg-amber-500/15 text-amber-400',
                      opus_escalation: 'bg-purple-500/15 text-purple-400',
                      skipped: 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]',
                    }
                    const style = actionStyles[ev.action] ?? 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                    const label: Record<string, string> = {
                      dispatched: 'dispatched',
                      suggested: 'suggested',
                      no_match: 'no match',
                      opus_escalation: 'opus',
                      skipped: 'skipped',
                    }
                    return (
                      <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                        <span className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${style}`}>
                          {label[ev.action] ?? ev.action}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-[var(--text-primary)] truncate">{ev.promptPreview ?? '—'}</div>
                          {ev.matchedRoute && (
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">→ {ev.matchedRoute}{ev.command ? ` (${ev.command})` : ''}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Environment */}
      {health && Object.keys(health.env).length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Environment</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {Object.entries(health.env).map(([key, val]) => (
                <div key={key} className="flex gap-3">
                  <dt className="text-[var(--text-muted)] font-medium min-w-[120px] shrink-0">{key}</dt>
                  <dd className="text-[var(--text-secondary)] font-mono text-xs break-all flex items-start gap-1">
                    <span>{val}</span>
                    <CopyButton text={String(val)} size={12} className="shrink-0 mt-[-2px]" />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}
    </div>
  )
}
