import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import StatusPill from '../LiveView/StatusPill'
import type { AgentStatus } from '../LiveView/StatusPill'
import type { ChainLike, AgentCardLike, SessionInput } from './graphTransform'
import { nodeId } from './graphLayout'

interface DetailPanelProps {
  nodeId: string
  chains: ChainLike[]
  sessions: SessionInput[]
  onClose: () => void
}

function findAgent(nodeId: string, agents: AgentCardLike[]): AgentCardLike | null {
  for (const a of agents) {
    const id = 'agent-' + a.agentName + '-' + a.startedAt
    if (id === nodeId) return a
    if (a.subAgents) {
      const found = findAgent(nodeId, a.subAgents)
      if (found) return found
    }
  }
  return null
}

function elapsedLabel(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const diff = Math.max(0, Math.floor((end - start) / 1000))
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

function modelShort(model?: string): string | null {
  if (!model) return null
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'Haiku'
  if (lower.includes('opus')) return 'Opus'
  if (lower.includes('sonnet')) return 'Sonnet'
  return model.slice(0, 12)
}

export default function DetailPanel({
  nodeId: selectedNodeId,
  chains,
  sessions,
  onClose,
}: DetailPanelProps) {
  // A session node ID starts with 'session-node-'
  const isSession = selectedNodeId.startsWith('session-node-')

  // Find the matching session if this is a session node
  const selectedSessionId = isSession ? selectedNodeId.slice('session-node-'.length) : null
  const selectedSession = selectedSessionId
    ? sessions.find(s => s.sessionId === selectedSessionId) ?? null
    : null

  // Find agent data across all chains
  let agent: AgentCardLike | null = null
  if (!isSession) {
    for (const chain of chains) {
      agent = findAgent(selectedNodeId, chain.agents)
      if (agent) break
    }
  }

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute right-0 top-0 h-full w-[300px] bg-[var(--bg-secondary)] border-l border-[var(--border)] z-20 p-4 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-base font-semibold text-[var(--text-primary)]">
            {isSession ? (selectedSession?.projectName ?? 'Session') : agent?.agentName ?? 'Unknown'}
          </span>
          {isSession ? (
            <span className="text-xs text-[var(--text-muted)] font-mono">{(selectedSessionId ?? '').slice(0, 8)}</span>
          ) : agent ? (
            <StatusPill status={agent.status as AgentStatus} />
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-0.5"
          aria-label="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {isSession ? (
        /* Session detail */
        <div className="flex flex-col gap-3">
          <Row label="Session" value={(selectedSessionId ?? '').slice(0, 12)} mono />
          <Row label="Project" value={selectedSession?.projectName ?? '—'} />
          <Row label="Cost" value={`$${(selectedSession?.costUsd ?? 0).toFixed(3)}`} mono />
          <Row label="Elapsed" value={elapsedLabel(new Date(Date.now() - (selectedSession?.elapsedMs ?? 0)).toISOString())} />
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[11px] text-[var(--text-muted)]">
              SESSION node — the central hub for this dispatch graph. All agent chains originate here.
            </p>
          </div>
        </div>
      ) : agent ? (
        /* Agent detail */
        <div className="flex flex-col gap-3">
          {agent.model && (
            <div className="inline-flex">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/15 text-purple-400">
                {modelShort(agent.model)}
              </span>
            </div>
          )}
          <Row label="Started" value={relativeTime(agent.startedAt)} />
          <Row label="Duration" value={elapsedLabel(agent.startedAt, agent.completedAt)} />
          {agent.currentActivity && agent.status === 'running' && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Activity</span>
              <div className="bg-[var(--bg-tertiary)] rounded p-2">
                <span className="font-mono text-xs text-[var(--text-secondary)] break-all">
                  {agent.currentActivity}
                </span>
              </div>
            </div>
          )}
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[11px] text-[var(--text-muted)]">
              View full agent history on the{' '}
              <a href="/agents" className="text-[var(--accent)] hover:underline">Agents page</a>.
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Agent data not found.</p>
      )}
    </motion.div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wide shrink-0">{label}</span>
      <span className={`text-xs text-[var(--text-secondary)] text-right truncate ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  )
}
