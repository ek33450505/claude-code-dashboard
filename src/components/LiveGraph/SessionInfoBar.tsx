interface SessionInfoBarProps {
  sessionId: string
  projectName: string
  costUsd: number
  elapsedMs: number
  totalTokens: number
  model?: string
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function modelShort(model?: string): string | null {
  if (!model) return null
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'Haiku'
  if (lower.includes('opus')) return 'Opus'
  if (lower.includes('sonnet')) return 'Sonnet'
  return model.slice(0, 12)
}

export default function SessionInfoBar({
  sessionId,
  projectName,
  costUsd,
  elapsedMs,
  totalTokens,
  model,
}: SessionInfoBarProps) {
  const short = modelShort(model)

  const parts = [
    projectName,
    sessionId.slice(0, 8),
    formatElapsed(elapsedMs),
    `$${(costUsd ?? 0).toFixed(3)}`,
    `${(totalTokens ?? 0).toLocaleString()} tok`,
    ...(short ? [short] : []),
  ]

  return (
    <div className="flex items-center h-10 border-t border-[var(--border)] bg-[var(--bg-primary)] px-4 shrink-0">
      <span className="text-xs font-mono text-[var(--text-muted)] truncate">
        {parts.join(' · ')}
      </span>
    </div>
  )
}
