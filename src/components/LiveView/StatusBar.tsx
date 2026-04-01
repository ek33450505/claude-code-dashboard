import { Activity } from 'lucide-react'

interface StatusBarProps {
  connected: boolean
  activeCount: number
  costUsd: number
  tokensPerMin: number
  sessionId?: string
}

export default function StatusBar({
  connected,
  activeCount,
  costUsd,
  tokensPerMin,
  sessionId,
}: StatusBarProps) {
  return (
    <div
      className="flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--bg-primary)] flex-shrink-0"
      style={{ height: 56 }}
    >
      {/* Left: live indicator + stats */}
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connected
                ? 'bg-[var(--accent)] animate-pulse'
                : 'bg-[var(--error)]'
            }`}
          />
          <span
            className={`font-semibold tracking-wide text-xs ${
              connected ? 'text-[var(--accent)]' : 'text-[var(--error)]'
            }`}
          >
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
        </span>

        <span className="text-[var(--border)] select-none">·</span>

        <span className="text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)] font-medium">
            {activeCount}
          </span>{' '}
          active
        </span>

        <span className="text-[var(--border)] select-none">·</span>

        <span className="text-[var(--text-secondary)]">
          $
          <span className="text-[var(--text-primary)] font-medium">
            {costUsd.toFixed(2)}
          </span>
        </span>

        <span className="text-[var(--border)] select-none">·</span>

        <span className="text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)] font-medium">
            {tokensPerMin.toLocaleString()}
          </span>{' '}
          tok/min
        </span>
      </div>

      {/* Right: Activity icon + session ID */}
      <div className="flex items-center gap-2 text-[var(--text-muted)]">
        <Activity size={14} />
        {sessionId && (
          <span className="font-mono text-xs truncate max-w-[120px]">
            {sessionId}
          </span>
        )}
      </div>
    </div>
  )
}
