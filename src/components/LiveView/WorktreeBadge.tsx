interface Props {
  branch: string
  status?: 'active' | 'merged' | 'conflict' | 'pending'
}

const STATUS_DOT: Record<string, string> = {
  active:  'bg-green-400',
  merged:  'bg-blue-400',
  conflict: 'bg-red-400',
  pending: 'bg-zinc-400',
}

export default function WorktreeBadge({ branch, status = 'active' }: Props) {
  const dotClass = STATUS_DOT[status] ?? STATUS_DOT.pending
  const shortBranch = branch.length > 8 ? `...${branch.slice(-6)}` : branch

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono text-green-400/80"
      title={`Worktree: ${branch} (${status})`}
    >
      <span>&#x1f333;</span>
      <span>{shortBranch}</span>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
    </span>
  )
}
