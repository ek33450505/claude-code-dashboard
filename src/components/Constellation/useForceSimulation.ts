import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3Force from 'd3-force'
import { getNodeRadius } from './constellationLayout'
import type { AgentNode, DispatchEdge, TaskNode, ConstellationGraph } from './constellationLayout'

export interface SimNode extends AgentNode {
  x: number
  y: number
  fx?: number | null
  fy?: number | null
  vx?: number
  vy?: number
  index?: number
}

export interface SimTaskNode extends TaskNode {
  x: number
  y: number
  vx?: number
  vy?: number
  index?: number
}

export interface SimEdge {
  source: SimNode
  target: SimNode
  dispatchCount24h: number
  lastDispatchAt: string
}

export interface SimulationState {
  nodes: SimNode[]
  taskNodes: SimTaskNode[]
  edges: SimEdge[]
  reheat: () => void
}

const EMPTY_STATE: SimulationState = {
  nodes: [],
  taskNodes: [],
  edges: [],
  reheat: () => undefined,
}

export function useForceSimulation(
  graph: ConstellationGraph,
  width: number,
  height: number,
): SimulationState {
  const [, setTick] = useState(0)
  const simRef = useRef<d3Force.Simulation<SimNode, SimEdge> | null>(null)
  const rafRef = useRef<number | null>(null)
  const simNodesRef = useRef<SimNode[]>([])
  const simTaskNodesRef = useRef<SimTaskNode[]>([])
  const simEdgesRef = useRef<SimEdge[]>([])
  const prevNodeIds = useRef<Set<string>>(new Set())

  const reheat = useCallback(() => {
    simRef.current?.alpha(0.3).restart()
  }, [])

  useEffect(() => {
    if (width === 0 || height === 0) return

    const cx = width / 2
    const cy = height / 2

    const incomingIds = new Set(graph.nodes.map(n => n.id))

    // Preserve existing positions for nodes that were already in the sim
    const existingPositions = new Map<string, { x: number; y: number; fx?: number | null; fy?: number | null }>()
    for (const sn of simNodesRef.current) {
      existingPositions.set(sn.id, { x: sn.x, y: sn.y, fx: sn.fx, fy: sn.fy })
    }

    // Build sim nodes, placing new nodes near center
    const nodes: SimNode[] = graph.nodes.map(n => {
      const prev = existingPositions.get(n.id)
      const isNew = !prevNodeIds.current.has(n.id)
      return {
        ...n,
        x: prev ? prev.x : cx + (Math.random() - 0.5) * 100,
        y: prev ? prev.y : cy + (Math.random() - 0.5) * 100,
        fx: prev?.fx ?? null,
        fy: prev?.fy ?? null,
      }
    })

    const nodeMap = new Map(nodes.map(n => [n.id, n]))

    // Build sim edges — only keep edges where both ends exist
    const edges: SimEdge[] = []
    for (const e of graph.edges) {
      const s = nodeMap.get(e.source)
      const t = nodeMap.get(e.target)
      if (s && t) {
        edges.push({ source: s, target: t, dispatchCount24h: e.dispatchCount24h, lastDispatchAt: e.lastDispatchAt })
      }
    }

    // Build task nodes — place near their parent
    const taskNodes: SimTaskNode[] = graph.taskNodes.map(t => {
      const parent = nodeMap.get(t.parentAgent)
      const angle = Math.random() * 2 * Math.PI
      const dist = 50 + Math.random() * 40
      return {
        ...t,
        x: parent ? parent.x + Math.cos(angle) * dist : cx,
        y: parent ? parent.y + Math.sin(angle) * dist : cy,
      }
    })

    simNodesRef.current = nodes
    simEdgesRef.current = edges
    simTaskNodesRef.current = taskNodes
    prevNodeIds.current = incomingIds

    // Build simulation
    const sim = d3Force.forceSimulation<SimNode, SimEdge>(nodes)
      .force('center', d3Force.forceCenter<SimNode>(cx, cy).strength(0.05))
      .force('charge', d3Force.forceManyBody<SimNode>().strength((d: SimNode) => {
        const r = getNodeRadius(d)
        return -r * 20
      }))
      .force('link', d3Force.forceLink<SimNode, SimEdge>(edges)
        .id((d: SimNode) => d.id)
        .distance((e: SimEdge) => {
          // Recent edges shorter
          const ageMs = Date.now() - new Date(e.lastDispatchAt).getTime()
          const base = 120
          const recencyFactor = ageMs < 60_000 ? 0.8 : 1.0
          return base * recencyFactor
        })
        .strength(0.3)
      )
      .force('collide', d3Force.forceCollide<SimNode>().radius((d: SimNode) => getNodeRadius(d) + 10))
      .alphaDecay(0.02)
      .velocityDecay(0.4)

    // Reheat if new nodes appeared
    const hasNewNodes = graph.nodes.some(n => !existingPositions.has(n.id))
    if (hasNewNodes) {
      sim.alpha(0.5)
    }

    simRef.current = sim

    // rAF-based tick — d3 mutates nodes, we just trigger React re-render
    function tick() {
      sim.tick()
      setTick(t => t + 1)
      if (sim.alpha() > sim.alphaMin()) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    // Stop the simulation's own timer — we drive ticks via rAF
    sim.stop()
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      sim.stop()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [graph, width, height])

  if (simNodesRef.current.length === 0) return EMPTY_STATE

  return {
    nodes: simNodesRef.current,
    taskNodes: simTaskNodesRef.current,
    edges: simEdgesRef.current,
    reheat,
  }
}
