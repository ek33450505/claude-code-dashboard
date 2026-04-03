interface ModelBadgeProps {
  model: string
}

function extractFamily(model: string): string {
  const lower = model.toLowerCase()
  if (lower.includes('haiku')) return 'haiku'
  if (lower.includes('opus')) return 'opus'
  if (lower.includes('sonnet')) return 'sonnet'
  return lower.split('-')[1] ?? lower
}

const FAMILY_STYLES: Record<string, string> = {
  haiku: 'bg-green-500/20 text-green-400 border border-green-500/30',
  sonnet: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  opus: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
}

export default function ModelBadge({ model }: ModelBadgeProps) {
  const family = extractFamily(model)
  const classes =
    FAMILY_STYLES[family] ?? 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium lowercase ${classes}`}
    >
      {family}
    </span>
  )
}
