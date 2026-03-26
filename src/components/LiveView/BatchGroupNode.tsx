import React from 'react'
import type { NodeProps } from '@xyflow/react'
import type { BatchGroupNodeData } from '../../utils/graphLayout'

export default function BatchGroupNode({ data }: NodeProps) {
  const { batchIndex, agentCount, isParallel } = data as BatchGroupNodeData

  return (
    <div
      className="w-full h-full rounded-xl border border-blue-500/20 bg-blue-500/5 pointer-events-none"
    >
      <span className="absolute top-1.5 left-2.5 text-[10px] text-blue-400/60 font-mono select-none">
        Batch {batchIndex}
        {isParallel && agentCount > 1 ? ` · ${agentCount} parallel` : ''}
      </span>
    </div>
  )
}
