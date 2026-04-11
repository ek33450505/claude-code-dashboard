import { useState } from 'react'
import { Network, MessageSquare, BarChart2, Users } from 'lucide-react'
import { useSwarmSessions, useSwarmDetail, useSwarmMessages } from '../api/useSwarm'
import { SwarmCard } from '../components/SwarmView/SwarmCard'
import { TeammateRow } from '../components/SwarmView/TeammateRow'
import { MessageFeed } from '../components/SwarmView/MessageFeed'
import { TokenChart } from '../components/SwarmView/TokenChart'
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
      <div className="flex border-b border-[var(--border)]">
        {([ 'teammates', 'messages', 'tokens' ] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors capitalize ${
              tab === t
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {t === 'teammates' && <Users className="w-3.5 h-3.5" />}
            {t === 'messages'  && <MessageSquare className="w-3.5 h-3.5" />}
            {t === 'tokens'    && <BarChart2 className="w-3.5 h-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="overflow-hidden">
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
        </>
      )}
    </div>
  )
}
