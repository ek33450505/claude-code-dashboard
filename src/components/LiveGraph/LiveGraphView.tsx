import { useState, useEffect, useMemo } from 'react'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { AnimatePresence } from 'framer-motion'
import { Activity } from 'lucide-react'
import SessionNode from './SessionNode'
import AgentGraphNode from './AgentGraphNode'
import DetailPanel from './DetailPanel'
import { buildGraphData, type ChainLike, type SessionInput } from './graphTransform'

interface LiveGraphViewProps {
  sessions: SessionInput[]
}

const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

export default function LiveGraphView({ sessions }: LiveGraphViewProps) {
  const nodeTypes: NodeTypes = useMemo(() => ({
    session: SessionNode,
    agent: AgentGraphNode,
  }), [])

  const initialGraphData = useMemo(
    () => buildGraphData(sessions, DEFAULT_WIDTH, DEFAULT_HEIGHT),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraphData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraphData.edges)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    const { nodes: next, edges: nextEdges } = buildGraphData(sessions, DEFAULT_WIDTH, DEFAULT_HEIGHT)
    setNodes(next)
    setEdges(nextEdges)
  }, [sessions, setNodes, setEdges])

  // Flatten all chains across all sessions for DetailPanel agent lookup
  const allChains: ChainLike[] = useMemo(
    () => sessions.flatMap(s => s.chains),
    [sessions]
  )

  const hasAgents = sessions.some(s => s.chains.some(c => c.agents.length > 0))

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        onPaneClick={() => setSelectedNodeId(null)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.25, includeHiddenNodes: false }}
        minZoom={0.2}
        maxZoom={2.5}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--bg-primary)' }}
      >
        <Background color="rgba(255,255,255,0.025)" gap={40} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          position="bottom-right"
          nodeColor={n => (n.data as Record<string, unknown>)?.status === 'running' ? '#00FFC2' : n.type === 'session' ? '#00FFC2' : 'rgba(52,211,153,0.6)'}
          maskColor="rgba(7,10,15,0.9)"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>

      {!hasAgents && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
          <Activity size={24} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">Waiting for dispatch…</span>
        </div>
      )}

      <AnimatePresence>
        {selectedNodeId && (
          <DetailPanel
            key={selectedNodeId}
            nodeId={selectedNodeId}
            chains={allChains}
            sessions={sessions}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
