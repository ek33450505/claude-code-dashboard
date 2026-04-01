// Pure layout engine — no React imports

/** @deprecated Use sessionNodeId(sessionId) instead */
export const SESSION_NODE_ID = 'session-node'

export function sessionNodeId(sessionId: string): string {
  return 'session-node-' + sessionId
}

export function nodeId(agentName: string, startedAt: string): string {
  return 'agent-' + agentName + '-' + startedAt
}

interface AgentLayoutNode {
  agentName: string
  startedAt: string
  children?: AgentLayoutNode[]
}

interface ChainLayoutInput {
  agents: AgentLayoutNode[]
}

export interface SessionLayoutInput {
  sessionId: string
  chains: ChainLayoutInput[]
}

const SESSION_SPACING = 900

/**
 * Compute radial positions for all nodes in the graph.
 * Accepts an array of sessions; each session gets its own center X spaced
 * SESSION_SPACING apart, all sharing the same cy.
 * Returns a Map<nodeId, { x, y }>.
 */
export function computeRadialPositions(
  sessions: SessionLayoutInput[],
  cx: number,
  cy: number,
  sessionSpacing = SESSION_SPACING
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  const N = sessions.length
  if (N === 0) return positions

  sessions.forEach((session, i) => {
    const sessionCx = cx + (i - (N - 1) / 2) * sessionSpacing
    const sessionId = session.sessionId

    // SESSION node at this session's center
    positions.set(sessionNodeId(sessionId), { x: sessionCx, y: cy })

    // Collect all depth-0 agents across all chains in this session
    const depth0Agents: AgentLayoutNode[] = []
    for (const chain of session.chains) {
      for (const agent of chain.agents) {
        depth0Agents.push(agent)
      }
    }

    const totalDepth0 = depth0Agents.length
    if (totalDepth0 === 0) return

    const radius0 = 240

    depth0Agents.forEach((agent, index) => {
      const angle = totalDepth0 === 1
        ? 0
        : (index / totalDepth0) * 2 * Math.PI

      const x = sessionCx + radius0 * Math.cos(angle)
      const y = cy + radius0 * Math.sin(angle)
      const id = nodeId(agent.agentName, agent.startedAt)
      positions.set(id, { x, y })

      // Depth-1 children
      const children = agent.children ?? []
      if (children.length === 0) return

      const radius1 = 160
      const arcSpan1 = (110 * Math.PI) / 180 // ±55°
      const startAngle1 = children.length === 1
        ? angle
        : angle - arcSpan1 / 2

      children.forEach((child, ci) => {
        const childAngle = children.length === 1
          ? angle
          : startAngle1 + (ci / (children.length - 1)) * arcSpan1

        const px = x + radius1 * Math.cos(childAngle)
        const py = y + radius1 * Math.sin(childAngle)
        const childId = nodeId(child.agentName, child.startedAt)
        positions.set(childId, { x: px, y: py })

        // Depth-2 grandchildren
        const grandchildren = child.children ?? []
        if (grandchildren.length === 0) return

        const radius2 = 110
        const arcSpan2 = (80 * Math.PI) / 180 // ±40°
        const startAngle2 = grandchildren.length === 1
          ? childAngle
          : childAngle - arcSpan2 / 2

        grandchildren.forEach((gc, gi) => {
          const gcAngle = grandchildren.length === 1
            ? childAngle
            : startAngle2 + (gi / (grandchildren.length - 1)) * arcSpan2

          const gx = px + radius2 * Math.cos(gcAngle)
          const gy = py + radius2 * Math.sin(gcAngle)
          positions.set(nodeId(gc.agentName, gc.startedAt), { x: gx, y: gy })
        })
      })
    })
  })

  return positions
}
