interface ModelBadgeProps {
  model?: string
  /** 'default' = SessionsView/SqliteExplorer chrome. 'compact' = DocsView chrome (border, 10px). */
  variant?: 'default' | 'compact'
  className?: string
}

export default function ModelBadge({ model, variant = 'default', className = '' }: ModelBadgeProps) {
  if (!model) return <span className="text-[var(--text-muted)] text-xs">—</span>
  const lower = model.toLowerCase()
  const label = lower.includes('fable') ? 'Fable'
    : lower.includes('opus') ? 'Opus'
    : lower.includes('haiku') ? 'Haiku'
    : lower.includes('sonnet') ? 'Sonnet'
    : model
  // Deliberately separate model-IDENTITY palette (fuchsia/orange/sky/indigo) — do NOT
  // reuse StatusPill.tsx's TONE semantic-state palette (emerald/amber/rose/violet/accent).
  const color = lower.includes('fable')
    ? 'bg-fuchsia-500/20 text-fuchsia-300'
    : lower.includes('opus')
    ? 'bg-orange-500/20 text-orange-300'
    : lower.includes('haiku')
    ? 'bg-sky-500/20 text-sky-300'
    : lower.includes('sonnet')
    ? 'bg-indigo-500/20 text-indigo-300'
    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
  const border = lower.includes('fable')
    ? 'border-fuchsia-500/20'
    : lower.includes('opus')
    ? 'border-orange-500/20'
    : lower.includes('haiku')
    ? 'border-sky-500/20'
    : lower.includes('sonnet')
    ? 'border-indigo-500/20'
    : 'border-[var(--border)]'
  const chrome = variant === 'compact'
    ? `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${border}`
    : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'
  return (
    <span className={`${chrome} ${color} ${className}`}>
      {label}
    </span>
  )
}
