import React, { useMemo } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  type NodeTypes,
  type EdgeTypes,
  type PanelPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { Network } from 'lucide-react'
import type { AgentCardProps } from './AgentCard'
import { buildGraph } from '../../utils/graphLayout'
import AgentNode from './AgentNode'
import AnimatedEdge from './AnimatedEdge'
import BatchGroupNode from './BatchGroupNode'

const nodeTypes: NodeTypes = {
  agentNode: AgentNode,
  batchGroup: BatchGroupNode,
}

const edgeTypes: EdgeTypes = {
  animated: AnimatedEdge,
}

interface DispatchGraphProps {
  agents: AgentCardProps[]
  isActive: boolean
  onNodeClick?: (agent: AgentCardProps) => void
}

export default function DispatchGraph({ agents, onNodeClick }: DispatchGraphProps) {
  const { nodes, edges } = useMemo(() => buildGraph(agents), [agents])

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] gap-2 text-muted-foreground/40">
        <Network size={32} className="opacity-30" />
        <p className="text-xs">No agents dispatched yet</p>
      </div>
    )
  }

  return (
    <div className="h-[420px] w-full rounded-xl border border-border/50 bg-card/30 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        onNodeClick={(_event, node) => {
          if (node.type === 'agentNode' && onNodeClick) {
            const agentData = node.data as { agent: AgentCardProps }
            onNodeClick(agentData.agent)
          }
        }}
      >
        <Background color="#334155" gap={20} size={1} />
        <MiniMap
          style={{ background: '#0f172a' }}
          maskColor="#1e293b80"
          nodeColor="#334155"
          zoomable
          pannable
        />
        <Controls
          showInteractive={false}
          position={'top-right' as PanelPosition}
          style={{ background: '#1e293b', border: '1px solid #334155' }}
        />
      </ReactFlow>
    </div>
  )
}
