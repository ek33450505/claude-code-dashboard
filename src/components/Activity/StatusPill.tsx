interface StatusPillProps {
  status: string
}

interface PillConfig {
  dot: string
  label: string
  text: string
  pulse?: boolean
}

const STATUS_MAP: Record<string, PillConfig> = {
  running: {
    dot: 'bg-blue-400',
    label: 'Running',
    text: 'text-blue-400',
    pulse: true,
  },
  DONE: {
    dot: 'bg-green-400',
    label: 'Done',
    text: 'text-green-400',
  },
  DONE_WITH_CONCERNS: {
    dot: 'bg-yellow-400',
    label: 'Concerns',
    text: 'text-yellow-400',
  },
  BLOCKED: {
    dot: 'bg-red-400',
    label: 'Blocked',
    text: 'text-red-400',
  },
  NEEDS_CONTEXT: {
    dot: 'bg-orange-400',
    label: 'Needs Context',
    text: 'text-orange-400',
  },
}

export default function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_MAP[status] ?? {
    dot: 'bg-zinc-400',
    label: status,
    text: 'text-zinc-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.text}`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}${config.pulse ? ' animate-pulse' : ''}`}
      />
      {config.label}
    </span>
  )
}
