import { useSseState } from '../../state/sseState'
import { useActiveAgents } from '../../api/useActiveAgents'
import { useTokenSpend } from '../../api/useTokenSpend'
import { useWorktrees } from '../../api/useSessionAgents'
import { formatCost } from '../../utils/costEstimate'

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ActivityStatusBar() {
  const { connected } = useSseState()
  const { data: activeAgents } = useActiveAgents()
  const { data: tokenSpend } = useTokenSpend()
  const { data: worktreesData } = useWorktrees()

  const activeCount = activeAgents?.length ?? 0

  const today = getTodayDate()
  const todayEntry = tokenSpend?.daily.find(d => d.date === today)
  const todayCost = todayEntry?.costUsd ?? 0

  const worktreeCount = worktreesData?.worktrees.length ?? 0

  return (
    <div
      className="flex items-center gap-4 px-4 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] flex-shrink-0 text-sm"
      style={{ height: 44 }}
    >
      {/* SSE connection */}
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            connected ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--error)]'
          }`}
        />
        <span
          className={`text-xs font-semibold tracking-wide ${
            connected ? 'text-[var(--accent)]' : 'text-[var(--error)]'
          }`}
        >
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </span>

      <span className="text-[var(--glass-border)] select-none">·</span>

      {/* Active agents */}
      <span className="text-[var(--text-secondary)] text-xs">
        <span className="text-[var(--text-primary)] font-medium">{activeCount}</span>
        {' '}active
      </span>

      <span className="text-[var(--glass-border)] select-none">·</span>

      {/* Today's cost */}
      <span className="text-[var(--text-secondary)] text-xs">
        <span className="text-[var(--text-primary)] font-medium">{formatCost(todayCost)}</span>
        {' '}today
      </span>

      <span className="text-[var(--glass-border)] select-none">·</span>

      {/* Active worktrees */}
      <span className="text-[var(--text-secondary)] text-xs">
        <span className="text-[var(--text-primary)] font-medium">{worktreeCount}</span>
        {' '}worktree{worktreeCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
