/**
 * Returns a relative time string like "2h ago", "3d ago", "just now".
 * Accepts an ISO date string.
 */
export function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then

  if (diffMs < 0) return 'just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (weeks < 5) return `${weeks}w ago`

  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Alias for timeAgo — accepts an ISO date string.
 */
export const relativeTime = timeAgo

/**
 * Returns a relative time string from an epoch milliseconds timestamp.
 */
export function timeAgoFromMs(epochMs: number): string {
  return timeAgo(new Date(epochMs).toISOString())
}

/**
 * Formats an ISO timestamp as a locale time string (HH:MM:SS).
 * Returns '' for null/invalid input.
 */
export function formatTimeOfDay(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return '' }
}

/**
 * Formats a duration in milliseconds as "Xm Ys" or "Xh Ym".
 * Accepts null (returns '--').
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  if (ms < 0) return '0s'
  if (ms < 1000) return '<1s'

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
