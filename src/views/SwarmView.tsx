import { useState } from 'react'
import { Network, MessageSquare, BarChart2, Users } from 'lucide-react'
import { useSwarmSessions, useSwarmDetail, useSwarmMessages } from '../api/useSwarm'
import { SwarmCard } from '../components/SwarmView/SwarmCard'
import { TeammateRow } from '../components/SwarmView/TeammateRow'
import { MessageFeed } from '../components/SwarmView/MessageFeed'
import { TokenChart } from '../components/SwarmView/TokenChart'
import { useManagedAgents } from '../api/useManagedAgents'
import Tabs from '../components/Tabs'
import { timeAgo } from '../utils/time'
import type { SwarmSession } from '../types'

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{label}</h2>
      {count !== undefined && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
          {count}
        </span>
      )}
    </div>
  )
}

// ── Swarm Detail Panel ────────────────────────────────────────────────────────

function SwarmDetailPanel({ swarmId }: { swarmId: string }) {
  const { data: detail, isLoading: detailLoading } = useSwarmDetail(swarmId)
  const { data: messages = [], isLoading: messagesLoading } = useSwarmMessages(swarmId)
  const [tab, setTab] = useState<'teammates' | 'messages' | 'tokens'>('teammates')

  if (detailLoading) {
    return (
      <div className="bento-card p-6 flex items-center justify-center">
        <span className="text-xs text-[var(--text-muted)] animate-pulse">Loading swarm details…</span>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="bento-card p-6 flex items-center justify-center">
        <span className="text-xs text-[var(--text-muted)]">Swarm not found</span>
      </div>
    )
  }

  const { session, teammates } = detail

  return (
    <div className="bento-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{session.team_name}</span>
        </div>
        {session.notes && (
          <p className="text-xs text-[var(--text-muted)] mt-1">{session.notes}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'teammates', label: 'Teammates', icon: Users },
          { id: 'messages', label: 'Messages', icon: MessageSquare },
          { id: 'tokens', label: 'Tokens', icon: BarChart2 },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as 'teammates' | 'messages' | 'tokens')}
        ariaLabel="Swarm detail views"
        idBase="swarm"
        size="xs"
      />

      {/* Tab content */}
      <div role="tabpanel" id="swarm-panel" aria-labelledby={`swarm-tab-${tab}`} className="overflow-hidden">
        {tab === 'teammates' && (
          <div>
            {teammates.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                No teammate runs recorded yet
              </div>
            ) : (
              teammates.map(t => <TeammateRow key={t.id} teammate={t} />)
            )}
          </div>
        )}

        {tab === 'messages' && (
          <div className="p-4">
            {messagesLoading ? (
              <div className="text-xs text-[var(--text-muted)] animate-pulse">Loading messages…</div>
            ) : (
              <MessageFeed messages={messages} />
            )}
          </div>
        )}

        {tab === 'tokens' && (
          <div className="p-4">
            <TokenChart teammates={teammates} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bento-card p-10 flex flex-col items-center justify-center gap-3 text-center col-span-full">
      <Network className="w-10 h-10 text-[var(--text-muted)] opacity-40" />
      <p className="text-sm font-medium text-[var(--text-muted)]">No swarms yet</p>
      <p className="text-xs text-[var(--text-muted)] max-w-xs">
        Start a swarm with <code className="bg-[var(--bg-tertiary)] px-1 rounded">/swarm &lt;team&gt; &quot;&lt;task&gt;&quot;</code> in Claude Code.
      </p>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────

const COL_TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]'

function ManagedAgentsSection() {
  const { data } = useManagedAgents()
  const invocations = data?.invocations ?? []

  return (
    <section>
      <SectionHeader label="Managed Agents" count={invocations.length} />
      {invocations.length === 0 ? (
        <div className="bento-card p-4">
          <p className="text-xs text-[var(--text-muted)]">
            No Managed Agent invocations yet — Anthropic-hosted agents (beta) appear here once dispatched via{' '}
            <code className="font-mono">cast-managed-agent.sh</code>.
          </p>
        </div>
      ) : (
        <div className="bento-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]" aria-label="Managed agent invocations">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className={COL_TH}>Agent</th>
                  <th scope="col" className={COL_TH}>Mode</th>
                  <th scope="col" className={COL_TH}>HTTP</th>
                  <th scope="col" className={COL_TH}>Exit</th>
                  <th scope="col" className={COL_TH}>Duration</th>
                  <th scope="col" className={COL_TH}>When</th>
                </tr>
              </thead>
              <tbody>
                {invocations.map(inv => (
                  <tr key={inv.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)]">{inv.agent_name}</td>
                    <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)]">{inv.mode ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-secondary)]">{inv.http_status ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-secondary)]">{inv.exit_code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[var(--text-muted)]">
                      {inv.session_duration_ms != null ? `${(inv.session_duration_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">{timeAgo(inv.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export default function SwarmView() {
  const { data: sessions = [], isLoading, isError } = useSwarmSessions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const active = sessions.filter((s: SwarmSession) => s.status === 'running')
  const past   = sessions.filter((s: SwarmSession) => s.status !== 'running')

  function handleSelect(id: string) {
    setSelectedId(prev => (prev === id ? null : id))
  }

  return (
    <div className="p-6 space-y-8 min-h-full">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Network className="w-6 h-6 text-[var(--accent)]" />
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Swarm</h1>
          <p className="text-xs text-[var(--text-muted)]">CAST Agent Team sessions</p>
        </div>
      </div>

      {isError && (
        <div className="bento-card p-4 border-rose-500/30 bg-rose-500/10">
          <p className="text-xs text-rose-400">Failed to load swarm sessions. Is the server running?</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bento-card p-5 animate-pulse">
              <div className="h-4 w-32 bg-[var(--bg-secondary)] rounded mb-3" />
              <div className="h-3 w-24 bg-[var(--bg-secondary)] rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <>
          {/* Active Swarms */}
          <section>
            <SectionHeader label="Active Swarms" count={active.length} />
            {active.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No active swarms</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {active.map((s: SwarmSession) => (
                  <SwarmCard
                    key={s.id}
                    session={s}
                    isSelected={selectedId === s.id}
                    onClick={() => handleSelect(s.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Detail panel for selected swarm */}
          {selectedId && (
            <section>
              <SwarmDetailPanel swarmId={selectedId} />
            </section>
          )}

          {/* Past Swarms */}
          <section>
            <SectionHeader label="Past Swarms" count={past.length} />
            {past.length === 0 && active.length === 0 ? (
              <EmptyState />
            ) : past.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No past swarms</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {past.map((s: SwarmSession) => (
                  <SwarmCard
                    key={s.id}
                    session={s}
                    isSelected={selectedId === s.id}
                    onClick={() => handleSelect(s.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Managed Agents (CAST v8 — Anthropic-hosted) */}
          <ManagedAgentsSection />
        </>
      )}
    </div>
  )
}
