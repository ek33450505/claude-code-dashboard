import { useEffect } from 'react'
import { X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface FileViewerProps {
  title: string
  content: string
  isOpen: boolean
  onClose: () => void
}

export default function FileViewer({ title, content, isOpen, onClose }: FileViewerProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bento-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <h2 className="text-sm font-semibold font-mono text-[var(--text-primary)] truncate">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose prose-invert prose-sm max-w-none
            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[var(--text-primary)] [&_h1]:mt-6 [&_h1]:mb-2
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--text-primary)] [&_h2]:mt-5 [&_h2]:mb-2
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--text-primary)] [&_h3]:mt-4 [&_h3]:mb-1
            [&_p]:text-sm [&_p]:text-[var(--text-secondary)] [&_p]:leading-relaxed [&_p]:mb-3
            [&_ul]:text-sm [&_ul]:text-[var(--text-secondary)] [&_ul]:mb-3 [&_ul]:pl-5
            [&_ol]:text-sm [&_ol]:text-[var(--text-secondary)] [&_ol]:mb-3 [&_ol]:pl-5
            [&_li]:mb-1
            [&_code]:font-mono [&_code]:text-[var(--accent)] [&_code]:text-xs [&_code]:bg-[var(--bg-primary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
            [&_pre]:bg-[var(--bg-primary)] [&_pre]:border [&_pre]:border-[var(--glass-border)] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto
            [&_pre_code]:bg-transparent [&_pre_code]:p-0
            [&_table]:w-full [&_table]:text-sm [&_table]:mb-4
            [&_th]:text-left [&_th]:text-[var(--text-muted)] [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:pb-2 [&_th]:border-b [&_th]:border-[var(--border)]
            [&_td]:py-2 [&_td]:text-[var(--text-secondary)] [&_td]:border-b [&_td]:border-[var(--border)]
            [&_hr]:border-[var(--border)] [&_hr]:my-6
            [&_strong]:text-[var(--text-primary)]
            [&_a]:text-[var(--accent)] [&_a]:no-underline
          ">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
