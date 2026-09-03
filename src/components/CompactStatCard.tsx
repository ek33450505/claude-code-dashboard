import { Link } from 'react-router-dom'

export default function CompactStatCard({
  icon: Icon,
  label,
  value,
  sub,
  to,
  accent,
  hover = true,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  to?: string
  accent?: string
  hover?: boolean
}) {
  const cardClassName = [
    'bento-card h-full p-5 flex items-start gap-4',
    hover && 'hover:border-[var(--accent)]/30 transition-colors',
  ].filter(Boolean).join(' ')

  const inner = (
    <div className={cardClassName}>
      <div className={`p-2.5 rounded-lg ${accent ?? 'bg-[var(--accent-subtle)]'} shrink-0`}>
        <Icon className="w-5 h-5 text-[var(--accent)]" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
        {sub && <div className="text-xs text-[var(--text-secondary)] mt-1">{sub}</div>}
      </div>
    </div>
  )

  return to ? <Link to={to} className="block no-underline h-full">{inner}</Link> : inner
}

export function CompactStatCardSkeleton() {
  return (
    <div className="bento-card p-5">
      <div className="h-4 w-24 rounded bg-[var(--bg-secondary)] animate-pulse mb-2" />
      <div className="h-8 w-16 rounded bg-[var(--bg-secondary)] animate-pulse" />
    </div>
  )
}
