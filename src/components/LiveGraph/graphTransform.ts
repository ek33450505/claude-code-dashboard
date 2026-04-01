import type { Node, Edge } from '@xyflow/react'
import type { SessionNodeData } from './SessionNode'
import type { AgentNodeData } from './AgentGraphNode'
import { computeRadialPositions, nodeId, SESSION_NODE_ID } from './graphLayout'

// ─── Local chain types (avoid circular dep with LiveView) ─────────────────────

export interface AgentCardLike {
  agentName: string
  status: string
  model?: string
  startedAt: string
  completedAt?: string
  currentActivity?: string
  subAgents?: AgentCardLike[]
}

export interface ChainLike {
  sessionId: string
  projectDir?: string
  agents: AgentCardLike[]
  isActive: boolean
  startedAt: string
}

// ─── Build graph data ─────────────────────────────────────────────────────────

function emitAgent(
  agent: AgentCardLike,
  parentId: string,
  depth: number,
  positions: Map<string, { x: number; y: number }>,
  nodes: Node[],
  edges: Edge[]
): void {
  const id = nodeId(agent.agentName, agent.startedAt)
  const pos = positions.get(id) ?? { x: 0, y: 0 }

  const isRunning = agent.status === 'running'
  const isTerminal = agent.status === 'DONE' || agent.status === 'DONE_WITH_CONCERNS' || agent.status === 'BLOCKED'

  const nodeData: AgentNodeData = {
    agentName: agent.agentName,
    status: agent.status as AgentNodeData['status'],
    model: agent.model,
    depth,
    currentActivity: agent.currentActivity,
    startedAt: agent.startedAt,
    completedAt: agent.completedAt,
  }

  nodes.push({
    id,
    type: 'agent',
    position: { x: pos.x - (depth === 0 ? 22 : depth === 1 ? 16 : 12), y: pos.y - (depth === 0 ? 22 : depth === 1 ? 16 : 12) },
    data: nodeData as unknown as Record<string, unknown>,
  })

  edges.push({
    id: `edge-${parentId}-${id}`,
    source: parentId,
    target: id,
    animated: isRunning,
    style: {
      stroke: isRunning
        ? '#00FFC2'
        : isTerminal
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,255,255,0.04)',
      strokeWidth: depth === 0 ? 2 : 1.5,
      strokeDasharray: agent.status === 'pending' ? '4 4' : undefined,
    },
  })

  const children = agent.subAgents ?? []
  for (const child of children) {
    emitAgent(child, id, depth + 1, positions, nodes, edges)
  }
}

export function buildGraphData(
  chains: ChainLike[],
  sessionId: string,
  projectName: string,
  sessionData: { costUsd: number; elapsedMs: number; connected: boolean },
  viewWidth: number,
  viewHeight: number
): { nodes: Node[]; edges: Edge[] } {
  const cx = viewWidth / 2
  const cy = viewHeight / 2

  // Build layout input — flatten to depth-0 agents with their subAgent trees
  const layoutChains = chains.map(c => ({
    agents: c.agents.map(a => ({
      agentName: a.agentName,
      startedAt: a.startedAt,
      children: mapSubAgentsForLayout(a.subAgents),
    })),
  }))

  const positions = computeRadialPositions(layoutChains, cx, cy)

  const nodes: Node[] = []
  const edges: Edge[] = []

  // SESSION node — offset so center of 64px circle is at (cx, cy)
  const sessionNodeData: SessionNodeData = {
    sessionId,
    projectName,
    ...sessionData,
  }

  nodes.push({
    id: SESSION_NODE_ID,
    type: 'session',
    position: { x: cx - 32, y: cy - 32 },
    data: sessionNodeData as unknown as Record<string, unknown>,
  })

  // Emit all agent trees
  for (const chain of chains) {
    for (const agent of chain.agents) {
      emitAgent(agent, SESSION_NODE_ID, 0, positions, nodes, edges)
    }
  }

  return { nodes, edges }
}

// ─── Layout helper ────────────────────────────────────────────────────────────

interface LayoutNode {
  agentName: string
  startedAt: string
  children?: LayoutNode[]
}

function mapSubAgentsForLayout(subAgents?: AgentCardLike[]): LayoutNode[] {
  if (!subAgents || subAgents.length === 0) return []
  return subAgents.map(a => ({
    agentName: a.agentName,
    startedAt: a.startedAt,
    children: mapSubAgentsForLayout(a.subAgents),
  }))
}
