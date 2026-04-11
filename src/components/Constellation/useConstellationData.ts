import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLiveEvents } from '../../api/useLive'
import type { LiveEvent } from '../../types'
import {
  deriveAgentStatus,
  type AgentNode,
  type ConstellationGraph,
  type DispatchEdge,
  type TaskNode,
} from './constellationLayout'

// Raw API shapes from GET /api/constellation/graph
interface RawNode {
  id: string
  model: 'haiku' | 'sonnet' | 'opus'
  runCount24h: number
  lastActiveAt: string | null
  totalTokens: number
  currentStatus: string | null
}

interface RawTask {
  taskId: string
  parentAgent: string
  subject: string | null
  status: string
  started_at: string
  ended_at: string | null
}

interface RawEdge {
  source: string
  target: string
  dispatchCount24h: number
  lastDispatchAt: string
}

interface ApiResponse {
  nodes: RawNode[]
  edges: RawEdge[]
  tasks: RawTask[]
}

async function fetchConstellationGraph(): Promise<ApiResponse> {
  const res = await fetch('/api/constellation/graph')
  if (!res.ok) throw new Error('Failed to fetch constellation graph')
  return res.json()
}

function transformGraph(raw: ApiResponse): ConstellationGraph {
  const nodes: AgentNode[] = raw.nodes.map(n => ({
    id: n.id,
    name: n.id,
    model: n.model,
    status: deriveAgentStatus(n.currentStatus, n.lastActiveAt, n.runCount24h),
    recentRunCount: n.runCount24h,
    lastActiveAt: n.lastActiveAt,
    totalTokens: n.totalTokens,
  }))

  const edges: DispatchEdge[] = raw.edges.map(e => ({
    source: e.source,
    target: e.target,
    dispatchCount24h: e.dispatchCount24h,
    lastDispatchAt: e.lastDispatchAt,
  }))

  // Group tasks by parent agent — max 6 per agent
  const tasksByAgent = new Map<string, RawTask[]>()
  for (const task of raw.tasks) {
    const existing = tasksByAgent.get(task.parentAgent) ?? []
    existing.push(task)
    tasksByAgent.set(task.parentAgent, existing)
  }

  const taskNodes: TaskNode[] = []
  for (const [, tasks] of tasksByAgent) {
    const capped = tasks.slice(0, 6)
    for (const t of capped) {
      taskNodes.push({
        taskId: t.taskId,
        parentAgent: t.parentAgent,
        subject: t.subject,
        status: t.status,
        startedAt: t.started_at,
        endedAt: t.ended_at,
      })
    }
  }

  return { nodes, edges, taskNodes }
}

export interface ConstellationDataResult {
  graph: ConstellationGraph
  isLoading: boolean
  lastEventAt: number | null
  recentlyFiredAgents: Set<string>
}

const EMPTY_GRAPH: ConstellationGraph = { nodes: [], edges: [], taskNodes: [] }

export function useConstellationData(): ConstellationDataResult {
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const [recentlyFiredAgents, setRecentlyFiredAgents] = useState<Set<string>>(new Set())
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: raw, isLoading, refetch } = useQuery({
    queryKey: ['constellation', 'graph'],
    queryFn: fetchConstellationGraph,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 1000,
  })

  // Debounced refetch on SSE db_change_agent_run
  const handleEvent = useCallback((event: LiveEvent) => {
    if (event.type !== 'db_change_agent_run') return

    setLastEventAt(Date.now())

    if (event.dbChangeAgentName) {
      const agentName = event.dbChangeAgentName
      setRecentlyFiredAgents(prev => {
        const next = new Set(prev)
        next.add(agentName)
        return next
      })
      // Clear the agent from fired set after 3 seconds
      setTimeout(() => {
        setRecentlyFiredAgents(prev => {
          const next = new Set(prev)
          next.delete(agentName)
          return next
        })
      }, 3000)
    }

    // Debounce refetch at 500ms
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null
      refetch()
    }, 500)
  }, [refetch])

  useLiveEvents(handleEvent)

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const graph = raw ? transformGraph(raw) : EMPTY_GRAPH

  return { graph, isLoading, lastEventAt, recentlyFiredAgents }
}
