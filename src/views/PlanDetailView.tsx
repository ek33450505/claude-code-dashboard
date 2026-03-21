import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { usePlan } from '../api/usePlans'

export default function PlanDetailView() {
  const { filename } = useParams<{ filename: string }>()
  const { data: plan, isLoading, error } = usePlan(filename || '')

  if (isLoading) {
    return <div className="p-8 text-[var(--text-muted)]">Loading plan...</div>
  }

  if (error || !plan) {
    return (
      <div className="p-8">
        <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Knowledge
        </Link>
        <p className="text-[var(--error)]">Failed to load plan.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto animate-in">
      <Link to="/knowledge" className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Knowledge
      </Link>

      <div className="bento-card p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">{plan.title || plan.filename}</h1>
        <p className="text-xs text-[var(--text-muted)] mb-6 font-mono">{plan.filename}</p>

        <div className="prose prose-invert max-w-none
          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-[var(--text-primary)] [&_h1]:mt-8 [&_h1]:mb-3
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--text-primary)] [&_h2]:mt-6 [&_h2]:mb-2
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[var(--text-primary)] [&_h3]:mt-4 [&_h3]:mb-2
          [&_p]:text-sm [&_p]:text-[var(--text-secondary)] [&_p]:leading-relaxed [&_p]:mb-3
          [&_ul]:text-sm [&_ul]:text-[var(--text-secondary)] [&_ul]:mb-3 [&_ul]:pl-5
          [&_ol]:text-sm [&_ol]:text-[var(--text-secondary)] [&_ol]:mb-3 [&_ol]:pl-5
          [&_li]:mb-1
          [&_code]:font-mono [&_code]:text-[var(--accent)] [&_code]:text-xs [&_code]:bg-[var(--bg-tertiary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
          [&_pre]:bg-[var(--bg-primary)] [&_pre]:border [&_pre]:border-[var(--glass-border)] [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          [&_table]:w-full [&_table]:text-sm [&_table]:mb-4
          [&_th]:text-left [&_th]:text-[var(--text-muted)] [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:pb-2 [&_th]:border-b [&_th]:border-[var(--border)]
          [&_td]:py-2 [&_td]:text-[var(--text-secondary)] [&_td]:border-b [&_td]:border-[var(--border)]
          [&_hr]:border-[var(--border)] [&_hr]:my-6
          [&_strong]:text-[var(--text-primary)] [&_strong]:font-semibold
          [&_a]:text-[var(--accent)] [&_a]:no-underline hover:[&_a]:text-[var(--accent-hover)]
          [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--text-secondary)] [&_blockquote]:italic
        ">
          <ReactMarkdown>{plan.body}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
