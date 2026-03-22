import { useDebugLogs } from '../../api/useDebug'
import { timeAgo } from '../../utils/time'
import { ExternalLink } from 'lucide-react'

interface DebugCategoryProps {
  onViewFile: (title: string, body: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DebugCategory({ onViewFile }: DebugCategoryProps) {
  const { data: logs } = useDebugLogs()

  if (!logs || logs.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No debug logs found</p>
  }

  async function fetchLog(id: string) {
    try {
      const res = await fetch(`/api/debug/${encodeURIComponent(id)}`)
      const data = await res.json()
      const suffix = data.truncated ? '\n\n---\n*Log truncated*' : ''
      onViewFile(`${id}.txt`, data.body + suffix)
    } catch {
      onViewFile(`${id}.txt`, 'Failed to load debug log.')
    }
  }

  return (
    <div className="grid gap-2">
      {logs.map(log => (
        <button
          key={log.id}
          onClick={() => fetchLog(log.id)}
          className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span
                className="text-sm font-medium text-[var(--text-primary)] font-mono truncate block"
                title={log.id}
              >
                {log.id.length > 12 ? log.id.slice(0, 12) + '...' : log.id}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {formatSize(log.size)} &middot; {timeAgo(log.modifiedAt)}
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>
      ))}
    </div>
  )
}
