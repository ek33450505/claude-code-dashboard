import type { Node, Edge } from '@xyflow/react'
import type { AgentCardProps } from '../components/LiveView/AgentCard'

export interface AgentNodeData extends Record<string, unknown> {
  agent: AgentCardProps
}

export interface BatchGroupNodeData extends Record<string, unknown> {
  batchIndex: number
  agentCount: number
  isParallel: boolean
}

const NODE_WIDTH = 224   // w-56 = 14rem = 224px
const NODE_HEIGHT = 100  // approximate height
const H_GAP = 24         // horizontal gap between nodes
const V_GAP = 80         // vertical gap between rows
const BATCH_PADDING = 16 // padding inside batch group

function nodeId(agent: AgentCardProps): string {
  return `agent-${agent.agentName}-${agent.startedAt}`
}

/**
 * Groups sub-agents into batches by startedAt proximity.
 * Agents that start within 10 seconds of each other are considered
 * the same parallel batch.
 */
function groupIntoBatches(subAgents: AgentCardProps[]): AgentCardProps[][] {
  if (subAgents.length === 0) return []

  const sorted = [...subAgents].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )

  const batches: AgentCardProps[][] = []
  let currentBatch: AgentCardProps[] = [sorted[0]]
  let batchStartTime = new Date(sorted[0].startedAt).getTime()

  for (let i = 1; i < sorted.length; i++) {
    const t = new Date(sorted[i].startedAt).getTime()
    if (t - batchStartTime <= 10_000) {
      currentBatch.push(sorted[i])
    } else {
      batches.push(currentBatch)
      currentBatch = [sorted[i]]
      batchStartTime = t
    }
  }
  batches.push(currentBatch)

  return batches
}

/**
 * Builds React Flow nodes and edges from an agent list.
 *
 * Layout:
 *   Row 0 (y=0): orchestrators, spaced horizontally
 *   Row 1+ (y=220+): sub-agent batches, each batch is a horizontal row
 *
 * Returns nodes (agentNode + batchGroup) and edges.
 */
export function buildGraph(agents: AgentCardProps[]): {
  nodes: Node[]
  edges: Edge[]
} {
  const orchestrators = agents.filter(a => !a.isSubagent)
  const subAgents = agents.filter(a => a.isSubagent)

  const nodes: Node[] = []
  const edges: Edge[] = []

  // ── Orchestrator row ─────────────────────────────────────────────────────
  const totalOrchestratorWidth =
    orchestrators.length * NODE_WIDTH + Math.max(0, orchestrators.length - 1) * H_GAP
  const orchStartX = -totalOrchestratorWidth / 2

  orchestrators.forEach((agent, i) => {
    const x = orchStartX + i * (NODE_WIDTH + H_GAP)
    nodes.push({
      id: nodeId(agent),
      type: 'agentNode',
      position: { x, y: 0 },
      data: { agent } as AgentNodeData,
      style: { width: NODE_WIDTH },
    })
  })

  // ── Sub-agent batches ────────────────────────────────────────────────────
  const batches = groupIntoBatches(subAgents)

  batches.forEach((batch, batchIdx) => {
    const rowY = NODE_HEIGHT + V_GAP + batchIdx * (NODE_HEIGHT + V_GAP)

    const totalBatchWidth =
      batch.length * NODE_WIDTH + Math.max(0, batch.length - 1) * H_GAP
    const batchStartX = -totalBatchWidth / 2

    // Batch group background node
    const groupId = `batch-group-${batchIdx}`
    nodes.push({
      id: groupId,
      type: 'batchGroup',
      position: {
        x: batchStartX - BATCH_PADDING,
        y: rowY - BATCH_PADDING,
      },
      data: {
        batchIndex: batchIdx + 1,
        agentCount: batch.length,
        isParallel: batch.length > 1,
      } as BatchGroupNodeData,
      style: {
        width: totalBatchWidth + BATCH_PADDING * 2,
        height: NODE_HEIGHT + BATCH_PADDING * 2,
        zIndex: -1,
      },
      selectable: false,
      draggable: false,
    })

    batch.forEach((agent, agentIdx) => {
      const x = batchStartX + agentIdx * (NODE_WIDTH + H_GAP)
      const id = nodeId(agent)

      nodes.push({
        id,
        type: 'agentNode',
        position: { x, y: rowY },
        data: { agent } as AgentNodeData,
        style: { width: NODE_WIDTH },
      })

      // Connect the last running orchestrator (or first orchestrator) to this sub-agent
      const runningOrch = orchestrators.filter(a => a.status === 'running')
      const sourceAgent =
        runningOrch.length > 0
          ? runningOrch[runningOrch.length - 1]
          : orchestrators[orchestrators.length - 1]

      if (sourceAgent) {
        edges.push({
          id: `edge-${nodeId(sourceAgent)}-${id}`,
          source: nodeId(sourceAgent),
          target: id,
          type: 'animated',
          data: { targetStatus: agent.status },
        })
      }
    })
  })

  // If only sub-agents (no orchestrators), just lay them out in batches with no edges
  return { nodes, edges }
}
