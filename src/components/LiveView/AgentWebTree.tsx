import { useRef, useLayoutEffect, useCallback } from 'react'
import AgentWebNode from './AgentWebNode'
import type { AgentCardProps } from './AgentCard'

interface NodeRecord {
  agent: AgentCardProps
  depth: number
  parentId: string | undefined
  nodeId: string
}

function flattenByDepth(
  agents: AgentCardProps[],
  depth = 0,
  parentId: string | undefined = undefined
): NodeRecord[] {
  return agents.flatMap(agent => {
    const nodeId = agent.agentId ?? agent.agentName ?? `node-${depth}-${Math.random()}`
    return [
      { agent, depth, parentId, nodeId },
      ...flattenByDepth(agent.subAgents ?? [], depth + 1, nodeId),
    ]
  })
}

function getStatusConnectorColor(status: string | undefined): string {
  switch (status) {
    case 'running': return 'rgba(96,165,250,0.5)'
    case 'DONE': return 'rgba(74,222,128,0.4)'
    case 'DONE_WITH_CONCERNS': return 'rgba(250,204,21,0.4)'
    case 'BLOCKED': return 'rgba(248,113,113,0.5)'
    case 'NEEDS_CONTEXT': return 'rgba(251,146,60,0.4)'
    default: return 'rgba(100,116,139,0.2)'
  }
}

interface AgentWebTreeProps {
  agents: AgentCardProps[]
}

export default function AgentWebTree({ agents }: AgentWebTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const nodeRecords = flattenByDepth(agents)
  const maxDepth = nodeRecords.reduce((m, r) => Math.max(m, r.depth), 0)
  const depthLevels: NodeRecord[][] = Array.from({ length: maxDepth + 1 }, (_, d) =>
    nodeRecords.filter(r => r.depth === d)
  )

  const drawConnectors = useCallback(() => {
    const container = containerRef.current
    const svg = svgRef.current
    if (!container || !svg) return

    const containerRect = container.getBoundingClientRect()
    svg.innerHTML = ''
    svg.setAttribute('width', String(container.offsetWidth))
    svg.setAttribute('height', String(container.offsetHeight))

    // Build nodeId → element map
    const nodeEls = new Map<string, Element>()
    container.querySelectorAll('[data-nodeid]').forEach(el => {
      const id = el.getAttribute('data-nodeid')
      if (id) nodeEls.set(id, el)
    })

    // Draw connector for each parent-child pair
    for (const record of nodeRecords) {
      if (!record.parentId) continue
      const parentEl = nodeEls.get(record.parentId)
      const childEl = nodeEls.get(record.nodeId)
      if (!parentEl || !childEl) continue

      const pRect = parentEl.getBoundingClientRect()
      const cRect = childEl.getBoundingClientRect()

      const px = pRect.left + pRect.width / 2 - containerRect.left
      const py = pRect.bottom - containerRect.top
      const cx = cRect.left + cRect.width / 2 - containerRect.left
      const cy = cRect.top - containerRect.top
      const midY = (py + cy) / 2

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`)
      path.setAttribute('fill', 'none')
      path.setAttribute('stroke', getStatusConnectorColor(record.agent.status))
      path.setAttribute('stroke-width', '1.5')
      svg.appendChild(path)
    }
  }, [nodeRecords])

  useLayoutEffect(() => {
    drawConnectors()
    const observer = new ResizeObserver(drawConnectors)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [drawConnectors])

  if (agents.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        waiting for agents…
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative py-4 px-2">
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ overflow: 'visible' }}
      />
      <div className="relative flex flex-col gap-8">
        {depthLevels.map((level, depth) => (
          <div key={depth} className="flex flex-row flex-wrap gap-4 justify-center">
            {level.map(record => (
              <AgentWebNode
                key={record.nodeId}
                agent={record.agent}
                nodeId={record.nodeId}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
