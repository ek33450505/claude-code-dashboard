import { useScripts } from '../../api/useScripts'
import { timeAgo } from '../../utils/time'
import { ExternalLink } from 'lucide-react'

interface ScriptsCategoryProps {
  onViewFile: (title: string, body: string) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ScriptsCategory({ onViewFile }: ScriptsCategoryProps) {
  const { data: scripts } = useScripts()

  if (!scripts || scripts.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] text-center py-4">No scripts found</p>
  }

  async function fetchScript(name: string) {
    try {
      const res = await fetch(`/api/scripts/${encodeURIComponent(name)}`)
      const data = await res.json()
      onViewFile(name, data.body)
    } catch {
      onViewFile(name, 'Failed to load script content.')
    }
  }

  return (
    <div className="grid gap-2">
      {scripts.map(script => (
        <button
          key={script.name}
          onClick={() => fetchScript(script.name)}
          className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)]/30 transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)] font-mono truncate block">{script.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {formatSize(script.size)} &middot; {timeAgo(script.modifiedAt)}
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>
        </button>
      ))}
    </div>
  )
}
