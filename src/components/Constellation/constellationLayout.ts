// Pure layout/style utilities for the Agent Constellation visualization

export type AgentModel = 'sonnet' | 'haiku' | 'opus' | string
export type AgentStatus = 'active' | 'recent' | 'idle' | 'dormant'
export type TaskStatus = 'pending' | 'active' | 'done' | 'failed' | 'running' | string

export interface AgentNode {
  id: string
  name: string
  model: AgentModel
  status: AgentStatus
  recentRunCount: number
  lastActiveAt: string | null
  totalTokens: number
}

export interface TaskNode {
  taskId: string
  parentAgent: string
  subject: string | null
  status: TaskStatus
  startedAt: string
  endedAt: string | null
}

export interface DispatchEdge {
  source: string
  target: string
  dispatchCount24h: number
  lastDispatchAt: string
}

export interface ConstellationGraph {
  nodes: AgentNode[]
  edges: DispatchEdge[]
  taskNodes: TaskNode[]
}

// ── Node radius ──────────────────────────────────────────────────────────────

/**
 * 20px dormant → 60px heavily active, scaled by recentRunCount
 */
export function getNodeRadius(node: AgentNode): number {
  const base = 20
  const max = 60
  if (node.status === 'dormant') return base
  if (node.recentRunCount === 0) return base
  // log scale: run counts of 1→20+ map to 20→60px
  const scaled = Math.log2(node.recentRunCount + 1) / Math.log2(21)
  return base + Math.round(scaled * (max - base))
}

// ── Node color by model ──────────────────────────────────────────────────────

export function getNodeColor(model: AgentModel): string {
  switch (model) {
    case 'sonnet': return '#22d3ee' // cyan-400
    case 'haiku':  return '#2dd4bf' // teal-400
    case 'opus':   return '#a78bfa' // violet-400
    default:       return '#22d3ee'
  }
}

// ── Edge opacity by recency ───────────────────────────────────────────────────

export function getEdgeOpacity(lastUsedIso: string): number {
  const ageMs = Date.now() - new Date(lastUsedIso).getTime()
  const age1h  = 60 * 60 * 1000
  const age24h = 24 * age1h

  if (ageMs < 60_000)  return 0.9  // last 60s — bright
  if (ageMs < age1h)   return 0.55
  if (ageMs < age24h)  return 0.20
  return 0.05                       // 24h+ — near invisible
}

// ── Glow intensity by status ─────────────────────────────────────────────────

/** Returns CSS drop-shadow filter string */
export function getGlowIntensity(status: AgentStatus, color: string): string {
  switch (status) {
    case 'active':  return `drop-shadow(0 0 12px ${color}) drop-shadow(0 0 24px ${color})`
    case 'recent':  return `drop-shadow(0 0 6px ${color}80)`
    case 'idle':
    case 'dormant':
    default:        return 'none'
  }
}

// ── Task satellite radius ────────────────────────────────────────────────────

export function getTaskSatelliteRadius(taskStatus: TaskStatus): number {
  switch (taskStatus) {
    case 'active':
    case 'running': return 12
    default:        return 8
  }
}

// ── Task status color ─────────────────────────────────────────────────────────

export function getTaskStatusColor(
  taskStatus: TaskStatus,
  parentColor: string
): { fill: string; stroke: string; fillOpacity: number } {
  switch (taskStatus) {
    case 'pending':
      return { fill: 'transparent', stroke: 'rgba(255,255,255,0.4)', fillOpacity: 0 }
    case 'active':
    case 'running':
      return { fill: parentColor, stroke: parentColor, fillOpacity: 1 }
    case 'done':
    case 'DONE':
    case 'DONE_WITH_CONCERNS':
      return { fill: '#4ade80', stroke: '#4ade80', fillOpacity: 1 }
    case 'failed':
    case 'BLOCKED':
    case 'NEEDS_CONTEXT':
      return { fill: '#f87171', stroke: '#f87171', fillOpacity: 1 }
    default:
      return { fill: parentColor, stroke: parentColor, fillOpacity: 0.6 }
  }
}

// ── Agent status derivation from raw DB status ───────────────────────────────

export function deriveAgentStatus(
  dbStatus: string | null,
  lastActiveAt: string | null,
  recentRunCount: number,
): AgentStatus {
  if (!lastActiveAt) return 'dormant'

  const ageMs = Date.now() - new Date(lastActiveAt).getTime()
  const isCurrentlyRunning =
    dbStatus === 'running' || dbStatus === 'in_progress'

  if (isCurrentlyRunning && ageMs < 30_000) return 'active'
  if (ageMs < 5 * 60_000) return 'recent'
  if (ageMs < 24 * 60 * 60_000 && recentRunCount > 0) return 'idle'
  return 'dormant'
}

// ── Edge stroke width (log scale) ────────────────────────────────────────────

export function getEdgeStrokeWidth(dispatchCount: number): number {
  if (dispatchCount <= 0) return 1
  return Math.max(1, Math.min(4, Math.log2(dispatchCount + 1)))
}
