import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import { ConstellationLegend } from './ConstellationLegend'
import {
  getNodeRadius,
  getNodeColor,
  getEdgeOpacity,
  getEdgeStrokeWidth,
  type AgentNode,
  type TaskNode,
  type ConstellationGraph,
} from './constellationLayout'

// ── Graph data types ──────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  name: string
  // Agent fields
  model?: string
  status?: string
  recentRunCount?: number
  // Task fields
  isTask?: boolean
  taskStatus?: string
  parentAgent?: string
  // Simulation size hint
  val?: number
}

interface GraphLink {
  source: string
  target: string
  dispatchCount24h?: number
  lastDispatchAt?: string
  isTaskLink?: boolean
}

interface ConstellationCanvasProps {
  graph: ConstellationGraph
  recentlyFiredAgents: Set<string>
  isEmpty: boolean
}

// ── Three.js node builder ────────────────────────────────────────────────────

function buildAgentObject(node: GraphNode, recentlyFired: boolean): THREE.Object3D {
  const group = new THREE.Group()

  const agentNode = {
    id: node.id,
    name: node.name,
    model: node.model ?? 'sonnet',
    status: (node.status ?? 'dormant') as AgentNode['status'],
    recentRunCount: node.recentRunCount ?? 0,
    lastActiveAt: null,
    totalTokens: 0,
  }

  const baseRadius = getNodeRadius(agentNode)
  const radius = Math.max(3, baseRadius / 4)
  const color = getNodeColor(agentNode.model)
  const colorHex = new THREE.Color(color)

  const isDormant = node.status === 'dormant'
  const isActive = node.status === 'active'
  const isRecent = node.status === 'recent'

  // Main sphere
  const sphereGeo = new THREE.SphereGeometry(radius, 32, 32)
  const sphereMat = new THREE.MeshPhongMaterial({
    color: colorHex,
    transparent: true,
    opacity: isDormant ? 0.3 : isActive ? 0.95 : 0.75,
    emissive: colorHex,
    emissiveIntensity: isActive ? 0.6 : isRecent ? 0.25 : 0.05,
    shininess: 80,
  })
  const sphere = new THREE.Mesh(sphereGeo, sphereMat)
  group.add(sphere)

  // Glow shell for active/recent
  if (isActive || isRecent || recentlyFired) {
    const glowGeo = new THREE.SphereGeometry(radius * (recentlyFired ? 2.0 : 1.6), 16, 16)
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: recentlyFired ? 0.25 : isActive ? 0.18 : 0.08,
      side: THREE.BackSide,
    })
    const glow = new THREE.Mesh(glowGeo, glowMat)
    group.add(glow)
  }

  // Pulse ring for active nodes
  if (isActive) {
    const ringGeo = new THREE.RingGeometry(radius * 1.4, radius * 1.6, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    group.add(ring)
  }

  // Sprite label
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 64)
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = isDormant ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.88)'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 6
  ctx.fillText(node.name, 128, 40)

  const texture = new THREE.CanvasTexture(canvas)
  const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true })
  const sprite = new THREE.Sprite(spriteMat)
  sprite.position.set(0, -(radius + 10), 0)
  sprite.scale.set(42, 12, 1)
  group.add(sprite)

  return group
}

function buildTaskObject(node: GraphNode): THREE.Object3D {
  const group = new THREE.Group()
  const radius = 3.5

  const status = node.taskStatus ?? 'pending'
  const isDone = status === 'done' || status === 'DONE' || status === 'DONE_WITH_CONCERNS'
  const isFailed = status === 'failed' || status === 'BLOCKED' || status === 'NEEDS_CONTEXT'
  const isActive = status === 'active' || status === 'running'
  const isPending = status === 'pending'

  let color: THREE.Color
  if (isDone) color = new THREE.Color('#4ade80')
  else if (isFailed) color = new THREE.Color('#f87171')
  else color = new THREE.Color('#22d3ee')

  if (isPending) {
    // Wireframe sphere for pending
    const geo = new THREE.SphereGeometry(radius, 12, 12)
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('rgba(255,255,255,0.4)'),
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    })
    group.add(new THREE.Mesh(geo, mat))
  } else {
    const geo = new THREE.SphereGeometry(radius, 16, 16)
    const mat = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: isActive ? 0.5 : 0.2,
      transparent: true,
      opacity: isActive ? 1.0 : 0.85,
    })
    group.add(new THREE.Mesh(geo, mat))
  }

  return group
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConstellationCanvas({ graph, recentlyFiredAgents, isEmpty }: ConstellationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Observe container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDimensions({ width: Math.round(width), height: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track whether initial zoom has happened
  const hasZoomedRef = useRef(false)

  // Configure forces when graph data changes
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    try {
      fg.d3Force('charge')?.strength(-800).distanceMax(600)
      fg.d3Force('link')?.distance(120).strength(0.15)
      fg.d3Force('center')?.strength(0.01)
      fg.d3ReheatSimulation?.()
    } catch {
      // Force config may fail before layout init
    }
  }, [graph])

  // Add scene lighting once on mount
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return

    const scene: THREE.Scene | undefined = fg.scene?.()
    if (!scene) return

    if (!scene.getObjectByName('__cast_ambient__')) {
      const ambient = new THREE.AmbientLight(0xffffff, 0.5)
      ambient.name = '__cast_ambient__'
      scene.add(ambient)
    }

    if (!scene.getObjectByName('__cast_key__')) {
      const keyLight = new THREE.DirectionalLight(0xffffff, 0.8)
      keyLight.position.set(200, 300, 150)
      keyLight.name = '__cast_key__'
      scene.add(keyLight)
    }
  }, [dimensions.width])

  // Zoom to fit once after initial simulation completes — no setTimeout
  const handleEngineStop = useCallback(() => {
    if (hasZoomedRef.current) return
    const fg = fgRef.current
    if (!fg) return
    hasZoomedRef.current = true
    fg.zoomToFit(400, 40)
  }, [])

  // Build ForceGraph3D graphData from ConstellationGraph
  const graphData = useCallback(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []

    // Agent nodes
    for (const agent of graph.nodes) {
      const agentNode: AgentNode = agent
      const baseRadius = getNodeRadius(agentNode)
      nodes.push({
        id: agent.id,
        name: agent.name,
        model: agent.model,
        status: agent.status,
        recentRunCount: agent.recentRunCount,
        isTask: false,
        val: Math.max(10, baseRadius),
      })
    }

    // Task nodes + links to parent — only if parent agent exists in our node set
    const agentIds = new Set(nodes.map(n => n.id))
    for (const task of graph.taskNodes) {
      if (!agentIds.has(task.parentAgent)) continue  // skip tasks for unknown agents
      const taskNodeId = `task-${task.taskId}`
      nodes.push({
        id: taskNodeId,
        name: task.subject ?? '',
        isTask: true,
        taskStatus: task.status,
        parentAgent: task.parentAgent,
        val: 0.5,
      })
      links.push({
        source: task.parentAgent,
        target: taskNodeId,
        isTaskLink: true,
      })
    }

    // Dispatch edges — only include edges where BOTH source and target exist as nodes
    const nodeIds = new Set(nodes.map(n => n.id))
    for (const edge of graph.edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        links.push({
          source: edge.source,
          target: edge.target,
          dispatchCount24h: edge.dispatchCount24h,
          lastDispatchAt: edge.lastDispatchAt,
          isTaskLink: false,
        })
      }
    }

    // Same for task links — parent agent must exist
    const validLinks = links.filter(l => {
      const src = typeof l.source === 'string' ? l.source : (l.source as any).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as any).id
      return nodeIds.has(src) && nodeIds.has(tgt)
    })

    return { nodes, links: validLinks }
  }, [graph])

  const nodeThreeObject = useCallback((node: object) => {
    const n = node as GraphNode
    if (n.isTask) {
      return buildTaskObject(n)
    }
    return buildAgentObject(n, recentlyFiredAgents.has(n.id))
  }, [recentlyFiredAgents])

  const linkColor = useCallback((link: object) => {
    const l = link as GraphLink
    if (l.isTaskLink) return 'rgba(100,116,139,0.3)'
    const age = l.lastDispatchAt ? Date.now() - new Date(l.lastDispatchAt).getTime() : Infinity
    if (age < 60_000)   return '#22d3ee'   // last 60s — bright cyan
    if (age < 3_600_000) return '#164e63'  // 1h — dim teal
    return '#1e293b'                        // older — near invisible
  }, [])

  const linkWidth = useCallback((link: object) => {
    const l = link as GraphLink
    if (l.isTaskLink) return 0.5
    return Math.min(getEdgeStrokeWidth(l.dispatchCount24h ?? 0), 3)
  }, [])

  // linkOpacity is a global scalar in ForceGraph3D (not per-link)
  // Per-link dimming is handled via linkColor returning dimmer colors for older edges

  const nodeLabel = useCallback((node: object) => {
    const n = node as GraphNode
    if (n.isTask) return `Task: ${n.name || '(unnamed)'} — ${n.taskStatus}`
    return `${n.name} · ${n.model} · ${n.status} · ${n.recentRunCount ?? 0} runs/24h`
  }, [])

  const data = graphData()

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: '#0a0e1a' }}
    >
      {dimensions.width > 0 && (
        <ForceGraph3D
          ref={fgRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#0a0e1a"
          graphData={data}
          nodeThreeObject={nodeThreeObject}
          nodeThreeObjectExtend={false}
          nodeLabel={nodeLabel}
          nodeVal={(node: object) => (node as GraphNode).val ?? 1}
          linkColor={linkColor}
          linkWidth={linkWidth}
          linkOpacity={0.6}
          linkDirectionalParticles={(link: object) => {
            const l = link as GraphLink
            if (l.isTaskLink) return 0
            const age = l.lastDispatchAt ? Date.now() - new Date(l.lastDispatchAt).getTime() : Infinity
            return age < 3_600_000 ? 3 : 0
          }}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={linkColor}
          enableNodeDrag
          showNavInfo={false}
          warmupTicks={300}
          cooldownTicks={400}
          d3AlphaDecay={0.012}
          d3VelocityDecay={0.2}
          d3AlphaMin={0.001}
          onEngineStop={handleEngineStop}
        />
      )}

      {/* Legend overlay */}
      <ConstellationLegend />

      {/* Empty state */}
      {isEmpty && dimensions.width > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-sm text-white/20">Waiting for agent activity...</span>
        </div>
      )}

      {/* Controls hint */}
      <div className="absolute bottom-3 left-3 text-[10px] text-white/20 pointer-events-none">
        Left-drag to orbit · Scroll to zoom · Right-drag to pan · Click nodes to select
      </div>
    </div>
  )
}
