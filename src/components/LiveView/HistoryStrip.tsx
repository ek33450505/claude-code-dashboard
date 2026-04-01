export interface CompletedChain {
  chainId: string
  projectName: string
  agentCount: number
  duration: string
  status: 'DONE' | 'BLOCKED'
  completedAt: string
}

interface HistoryStripProps {
  completedChains: CompletedChain[]
}

export default function HistoryStrip({ completedChains }: HistoryStripProps) {
  return (
    <div
      className="flex items-center gap-3 px-3 border-t border-[var(--border)] bg-[var(--bg-primary)] flex-shrink-0 overflow-hidden"
      style={{ height: 64 }}
    >
      {/* Label */}
      <span className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase flex-shrink-0">
        Completed
      </span>

      {/* Scrollable pill row */}
      <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {completedChains.length === 0 ? (
          <span className="text-[var(--text-muted)] text-xs">No completed chains yet</span>
        ) : (
          completedChains.map(chain => {
            const isDone = chain.status === 'DONE'
            const pillCls = isDone
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
            const badge = isDone
              ? <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-green-500/20 text-green-300">DONE</span>
              : <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-red-500/20 text-red-300">BLOCKED</span>

            return (
              <div
                key={chain.chainId}
                className={`flex-shrink-0 flex items-center gap-1 h-8 rounded-full border px-2.5 text-xs whitespace-nowrap cursor-default ${pillCls}`}
              >
                <span className="font-medium">{chain.projectName}</span>
                <span className="opacity-50">·</span>
                <span className="opacity-70">{chain.agentCount} agent{chain.agentCount !== 1 ? 's' : ''}</span>
                <span className="opacity-50">·</span>
                <span className="font-mono text-[10px] opacity-70">{chain.duration}</span>
                {badge}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
