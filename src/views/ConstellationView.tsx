import { useMemo } from 'react'
import { useConstellationData } from '../components/Constellation/useConstellationData'
import { ConstellationCanvas } from '../components/Constellation/ConstellationCanvas'

export default function ConstellationView() {
  const { graph, isLoading, recentlyFiredAgents } = useConstellationData()

  const isEmpty = useMemo(() => {
    // Empty if no nodes have had any runs in 24h
    return graph.nodes.every(n => n.recentRunCount === 0)
  }, [graph.nodes])

  if (isLoading && graph.nodes.length === 0) {
    return (
      <div
        className="flex items-center justify-center w-full h-full"
        style={{ background: '#0a0e1a', minHeight: '600px' }}
      >
        <span className="text-sm text-white/20 animate-pulse">Loading constellation...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ minHeight: '600px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-base font-semibold text-[var(--text-primary)]">Agent Constellation</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            3D force-directed graph of all {graph.nodes.length} CAST agents
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>
            <span className="text-[var(--text-secondary)]">{graph.nodes.filter(n => n.status === 'active').length}</span> active
          </span>
          <span>
            <span className="text-[var(--text-secondary)]">{graph.taskNodes.length}</span> tasks
          </span>
          <span>
            <span className="text-[var(--text-secondary)]">{graph.edges.length}</span> edges
          </span>
        </div>
      </div>

      {/* Canvas — fill remaining height */}
      <div className="flex-1 relative">
        <ConstellationCanvas
          graph={graph}
          recentlyFiredAgents={recentlyFiredAgents}
          isEmpty={isEmpty}
        />
      </div>
    </div>
  )
}
