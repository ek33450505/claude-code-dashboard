import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { OrchestrationNode } from '../../types'
import { getBadgeColor } from './agentColors'

const STATUS_STYLES: Record<OrchestrationNode['status'], { ring: string; bg: string; dot: string }> = {
  queued:   { ring: 'border-zinc-500/40', bg: 'bg-zinc-500/5',   dot: 'bg-zinc-500' },
  running:  { ring: 'border-blue-500/60',  bg: 'bg-blue-500/10',  dot: 'bg-blue-500 animate-pulse' },
  done:     { ring: 'border-green-500/60', bg: 'bg-green-500/10', dot: 'bg-green-500' },
  blocked:  { ring: 'border-red-500/60',   bg: 'bg-red-500/10',   dot: 'bg-red-500' },
  concerns: { ring: 'border-amber-500/60', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
}

interface Props {
  nodes: OrchestrationNode[]
  onSelectNode?: (node: OrchestrationNode) => void
}

export default function OrchestrationFlow({ nodes, onSelectNode }: Props) {
  // Group nodes by batchId
  const batches = useMemo(() => {
    if (nodes.length === 0) return []
    const map = new Map<number, OrchestrationNode[]>()
    for (const node of nodes) {
      const batch = map.get(node.batchId) ?? []
      batch.push(node)
      map.set(node.batchId, batch)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([batchId, batchNodes]) => ({ batchId, nodes: batchNodes }))
  }, [nodes])

  if (batches.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
      <div className="px-4 py-2 border-b border-border">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          Orchestration Flow
        </span>
      </div>

      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {batches.map((batch, batchIdx) => (
            <div key={batch.batchId} className="flex items-center gap-2">
              {/* Batch column: stack parallel nodes vertically */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-mono text-muted-foreground/40 text-center mb-0.5">
                  B{batch.batchId}
                </span>
                {batch.nodes.map(node => {
                  const style = STATUS_STYLES[node.status]
                  return (
                    <motion.button
                      key={node.id}
                      onClick={() => onSelectNode?.(node)}
                      className={`
                        flex items-center gap-2 px-3 py-2 rounded-md border
                        ${style.ring} ${style.bg}
                        hover:brightness-110 transition-all cursor-pointer
                        min-w-[120px]
                      `}
                      layout
                      transition={{ duration: 0.2 }}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                      <span className={`text-[11px] font-mono font-medium truncate ${getBadgeColor(node.agentName).replace(/bg-\S+/, '').trim()}`}>
                        {node.agentName}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              {/* Arrow between batches */}
              {batchIdx < batches.length - 1 && (
                <svg width="24" height="20" viewBox="0 0 24 20" className="flex-shrink-0 text-muted-foreground/30">
                  <line x1="0" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" />
                  <polygon points="18,6 24,10 18,14" fill="currentColor" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
