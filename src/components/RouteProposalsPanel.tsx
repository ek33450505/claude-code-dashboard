import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useRoutingProposals, useProposalAction } from '../api/useRouting'
import type { RouteProposal } from '../api/useRouting'

function ProposalRow({ proposal }: { proposal: RouteProposal }) {
  const { mutate, isPending, error, reset } = useProposalAction()
  const [actionId, setActionId] = useState<'approve' | 'reject' | null>(null)

  const handleAction = (action: 'approve' | 'reject') => {
    reset()
    setActionId(action)
    mutate({ id: proposal.id, action })
  }

  const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n) + '…' : s

  return (
    <tr className="border-b border-[var(--border)]/50">
      <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
        {proposal.id}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs text-[var(--text-muted)] max-w-[160px]">
        {proposal.patterns.join(', ')}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--text-primary)] whitespace-nowrap">
        {proposal.agent}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] text-right tabular-nums">
        {proposal.frequency}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--text-muted)] max-w-[200px] hidden md:table-cell">
        {proposal.example_prompts.slice(0, 2).map((e, i) => (
          <span key={i} className="mr-2 italic">&ldquo;{truncate(e, 40)}&rdquo;</span>
        ))}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={isPending}
            className="px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40 transition-colors disabled:opacity-40"
          >
            {isPending && actionId === 'approve' ? '...' : 'Approve'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={isPending}
            className="px-2 py-1 rounded text-xs font-medium bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/40 transition-colors disabled:opacity-40"
          >
            {isPending && actionId === 'reject' ? '...' : 'Reject'}
          </button>
          {error && (
            <span className="text-xs text-red-400 ml-1">{(error as Error).message}</span>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function RouteProposalsPanel() {
  const { data, isLoading } = useRoutingProposals()
  const [collapsed, setCollapsed] = useState(false)

  if (isLoading) return null

  const pendingCount = data?.pendingCount ?? 0
  const pending = (data?.proposals ?? []).filter(p => p.status === 'pending')

  if (pendingCount === 0) return null

  return (
    <div className="bento-card overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-tertiary)]/30 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">Route Proposals</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">
            {pendingCount}
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          Review and install suggested routing rules
        </span>
      </button>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto border-t border-[var(--border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-2 font-medium">Patterns</th>
                <th className="text-left px-3 py-2 font-medium">Agent</th>
                <th className="text-right px-3 py-2 font-medium">Freq</th>
                <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Examples</th>
                <th className="text-left px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <ProposalRow key={p.id} proposal={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
