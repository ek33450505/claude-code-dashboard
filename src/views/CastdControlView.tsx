import { Server, RefreshCw, Play, Square } from 'lucide-react'
import { useCastdStatus, useCastdLogs, useCastdStart, useCastdStop } from '../api/useCastdControl'

function logLineColor(line: string): string {
  if (line.includes('[ERROR]')) return '#FB7185'
  if (line.includes('[WARN]')) return '#F59E0B'
  if (line.includes('[INFO]')) return '#00FFC2'
  if (line.includes('[DEBUG]')) return '#6B7280'
  return '#9CA3AF'
}

export default function CastdControlView() {
  const { data: status, isLoading: statusLoading } = useCastdStatus()
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useCastdLogs()
  const startMutation = useCastdStart()
  const stopMutation = useCastdStop()

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">castd Control</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Daemon status and log tail — status auto-refreshes every 5s</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Daemon status */}
        <div className="bento-card p-6 space-y-6">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">Daemon Status</h2>

          {statusLoading ? (
            <div className="space-y-3">
              <div className="h-16 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
              <div className="h-8 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
            </div>
          ) : (
            <>
              {/* Status indicator */}
              <div className="flex items-center gap-4">
                <span className="relative flex h-5 w-5 shrink-0">
                  {status?.running ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-60" />
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-[var(--success)]" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-5 w-5 bg-[var(--text-muted)] opacity-40" />
                  )}
                </span>
                <div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {status?.running ? 'Running' : 'Stopped'}
                  </div>
                  {status?.pid && (
                    <div className="text-xs text-[var(--text-muted)] font-mono">PID {status.pid}</div>
                  )}
                </div>
              </div>

              {/* Queue depth */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <span className="text-sm text-[var(--text-muted)]">Pending tasks</span>
                <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums">
                  {status?.queueDepth ?? 0}
                </span>
              </div>

              {/* Start / Stop buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => startMutation.mutate()}
                  disabled={status?.running || startMutation.isPending || stopMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-[#070A0F] font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  {startMutation.isPending ? 'Starting...' : 'Start'}
                </button>
                <button
                  onClick={() => stopMutation.mutate()}
                  disabled={!status?.running || startMutation.isPending || stopMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--error)] text-[var(--error)] font-semibold text-sm hover:bg-[rgba(251,113,133,0.1)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Square className="w-4 h-4" />
                  {stopMutation.isPending ? 'Stopping...' : 'Stop'}
                </button>
              </div>

              {(startMutation.error || stopMutation.error) && (
                <div className="text-xs text-[var(--error)] p-2 rounded bg-[rgba(251,113,133,0.1)]">
                  {String(startMutation.error ?? stopMutation.error)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Log tail */}
        <div className="bento-card p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)]">castd Log (last 100 lines)</h2>
            <button
              onClick={() => refetchLogs()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <div className="flex-1 h-64 rounded-lg bg-[var(--bg-secondary)] animate-pulse" />
          ) : logs?.lines?.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
              <div className="text-center">
                <Server className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <div>No log output yet</div>
                <div className="text-xs mt-1">castd.log will appear here once the daemon runs</div>
              </div>
            </div>
          ) : (
            <div
              className="flex-1 overflow-y-auto rounded-lg p-3 font-mono text-xs leading-relaxed"
              style={{ backgroundColor: '#0D0F14', maxHeight: '400px' }}
            >
              {(logs?.lines ?? []).map((line, i) => (
                <div key={i} style={{ color: logLineColor(line) }}>{line}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
