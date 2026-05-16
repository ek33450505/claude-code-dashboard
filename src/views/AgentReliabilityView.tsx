import { useState } from 'react'
import { ShieldAlert, CheckCircle2 } from 'lucide-react'
import { useAgentHallucinations, useAgentHallucinationStats } from '../api/useAgentHallucinations'
import { timeAgo } from '../utils/time'

function SkeletonRows() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-24" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-20" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-32" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-20" /></td>
          <td className="px-4 py-3"><div className="h-4 rounded bg-[var(--bg-secondary)] animate-pulse w-16" /></td>
        </tr>
      ))}
    </>
  )
}

function ClaimTypeBadge({ type }: { type: string }) {
  const color = type === 'file_write'
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {type}
    </span>
  )
}

const AGENT_COLORS = [
  'bg-violet-500/20 text-violet-300',
  'bg-blue-500/20 text-blue-300',
  'bg-teal-500/20 text-teal-300',
  'bg-rose-500/20 text-rose-300',
  'bg-orange-500/20 text-orange-300',
]

export default function AgentReliabilityView() {
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [unverifiedOnly, setUnverifiedOnly] = useState(false)

  const { data: statsData } = useAgentHallucinationStats()
  const stats = statsData ?? { total: 0, by_agent: [], by_type: [] }

  const { data, isLoading } = useAgentHallucinations(selectedAgent || undefined)
  const allEntries = data?.entries ?? []
  const entries = unverifiedOnly ? allEntries.filter(e => e.verified === 0) : allEntries

  const top3Agents = stats.by_agent.slice(0, 3)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Agent Reliability</h1>
        </div>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Unverified claims detected by CAST quality gate
        </p>
      </div>

      {/* Stat bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="bento-card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">{stats.total}</span>
          <span className="text-xs text-[var(--text-muted)]">total claims</span>
        </div>
        {top3Agents.map((a, i) => (
          <div
            key={a.agent_name}
            className={`bento-card px-3 py-2 flex items-center gap-2 cursor-pointer transition-opacity ${selectedAgent === a.agent_name ? 'ring-1 ring-[var(--accent)]' : ''}`}
            onClick={() => setSelectedAgent(prev => prev === a.agent_name ? '' : a.agent_name)}
          >
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${AGENT_COLORS[i % AGENT_COLORS.length]}`}>
              {a.agent_name}
            </span>
            <span className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{a.count}</span>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedAgent}
          onChange={e => setSelectedAgent(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          aria-label="Filter by agent"
        >
          <option value="">All agents</option>
          {stats.by_agent.map(a => (
            <option key={a.agent_name} value={a.agent_name}>
              {a.agent_name} ({a.count})
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={unverifiedOnly}
            onChange={e => setUnverifiedOnly(e.target.checked)}
            className="rounded accent-[var(--accent)]"
          />
          Unverified only
        </label>

        {(selectedAgent || unverifiedOnly) && (
          <button
            onClick={() => { setSelectedAgent(''); setUnverifiedOnly(false) }}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bento-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Agent</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Claim Type</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Claimed Value</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actual Value</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <SkeletonRows />
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" aria-hidden="true" />
                    <span className="text-sm text-[var(--text-muted)]">No unverified claims</span>
                  </td>
                </tr>
              ) : (
                entries.map(entry => {
                  const claimedShort = entry.claimed_value
                    ? entry.claimed_value.split('/').pop() ?? entry.claimed_value
                    : null
                  const isNotFound = entry.actual_value === null || entry.actual_value === '[NOT FOUND]' || entry.actual_value === ''
                  return (
                    <tr key={entry.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                      <td className="px-4 py-2.5 text-xs font-mono text-[var(--text-secondary)]">
                        {entry.agent_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <ClaimTypeBadge type={entry.claim_type} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-secondary)] max-w-[200px]">
                        {entry.claimed_value ? (
                          <span title={entry.claimed_value} className="truncate block">
                            {claimedShort}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs max-w-[200px]">
                        {isNotFound ? (
                          <span className="text-rose-400 font-medium">[NOT FOUND]</span>
                        ) : (
                          <span className="text-[var(--text-secondary)] truncate block" title={entry.actual_value ?? ''}>
                            {entry.actual_value}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                        {timeAgo(entry.timestamp)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
