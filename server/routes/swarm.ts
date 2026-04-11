import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const swarmRouter = Router()
export const constellationRouter = Router()

// ── Hardcoded 17 CAST agent registry ─────────────────────────────────────────

const CAST_AGENTS: Array<{ name: string; model: 'haiku' | 'sonnet' }> = [
  { name: 'commit',            model: 'haiku'  },
  { name: 'code-reviewer',     model: 'haiku'  },
  { name: 'test-runner',       model: 'haiku'  },
  { name: 'push',              model: 'haiku'  },
  { name: 'code-writer',       model: 'sonnet' },
  { name: 'debugger',          model: 'sonnet' },
  { name: 'test-writer',       model: 'haiku'  },
  { name: 'planner',           model: 'sonnet' },
  { name: 'security',          model: 'sonnet' },
  { name: 'researcher',        model: 'sonnet' },
  { name: 'orchestrator',      model: 'sonnet' },
  { name: 'bash-specialist',   model: 'haiku'  },
  { name: 'devops',            model: 'haiku'  },
  { name: 'docs',              model: 'haiku'  },
  { name: 'merge',             model: 'haiku'  },
  { name: 'morning-briefing',  model: 'haiku'  },
  { name: 'frontend-qa',       model: 'haiku'  },
]

// ── GET /api/swarm/sessions ───────────────────────────────────────────────────

swarmRouter.get('/sessions', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ sessions: [] })
    }

    // Guard: table may not exist yet on older cast.db installs
    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.json({ sessions: [] })
    }

    const sessions = db.prepare(`
      SELECT
        ss.*,
        COUNT(tr.id) AS teammate_count,
        COALESCE(SUM(tr.tokens_in + tr.tokens_out), 0) AS total_tokens
      FROM swarm_sessions ss
      LEFT JOIN teammate_runs tr ON tr.swarm_id = ss.id
      GROUP BY ss.id
      ORDER BY ss.started_at DESC
      LIMIT 50
    `).all() as Array<Record<string, unknown>>

    res.json({ sessions })
  } catch (err) {
    console.error('Swarm sessions error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm sessions' })
  }
})

// ── GET /api/swarm/sessions/:id ───────────────────────────────────────────────

swarmRouter.get('/sessions/:id', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const session = db.prepare(
      `SELECT * FROM swarm_sessions WHERE id = ?`
    ).get(req.params.id) as Record<string, unknown> | undefined

    if (!session) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const teammates = db.prepare(
      `SELECT * FROM teammate_runs WHERE swarm_id = ? ORDER BY started_at ASC`
    ).all(req.params.id) as Array<Record<string, unknown>>

    res.json({ session, teammates })
  } catch (err) {
    console.error('Swarm session detail error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm session' })
  }
})

// ── GET /api/swarm/sessions/:id/messages ─────────────────────────────────────

swarmRouter.get('/sessions/:id/messages', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ messages: [] })
    }

    const tableExists = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='swarm_sessions'`
    ).get()
    if (!tableExists) {
      return res.json({ messages: [] })
    }

    // 404 if swarm doesn't exist
    const session = db.prepare(
      `SELECT id FROM swarm_sessions WHERE id = ?`
    ).get(req.params.id)
    if (!session) {
      return res.status(404).json({ error: 'Swarm not found' })
    }

    const messages = db.prepare(`
      SELECT * FROM teammate_messages
      WHERE swarm_id = ?
      ORDER BY timestamp DESC
      LIMIT 200
    `).all(req.params.id) as Array<Record<string, unknown>>

    res.json({ messages })
  } catch (err) {
    console.error('Swarm messages error:', err)
    res.status(500).json({ error: 'Failed to fetch swarm messages' })
  }
})

// ── GET /api/constellation/graph ─────────────────────────────────────────────

constellationRouter.get('/graph', (_req, res) => {
  try {
    const db = getCastDb()

    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const cutoff1h  = new Date(Date.now() -      60 * 60 * 1000).toISOString()

    // Agent run counts per agent in last 24h
    let runStatsRows: Array<{ agent: string; runCount24h: number; lastActiveAt: string | null; totalTokensIn: number; totalTokensOut: number }> = []
    let statusRows: Array<{ agent: string; status: string }> = []
    let edgeRows: Array<{ source: string; target: string; dispatchCount24h: number; lastDispatchAt: string }> = []
    let taskRows: Array<{ id: string; agent: string; task_summary: string | null; status: string; started_at: string; ended_at: string | null }> = []

    if (db) {
      runStatsRows = db.prepare(`
        SELECT
          agent,
          COUNT(*) AS runCount24h,
          MAX(started_at) AS lastActiveAt,
          COALESCE(SUM(input_tokens), 0) AS totalTokensIn,
          COALESCE(SUM(output_tokens), 0) AS totalTokensOut
        FROM agent_runs
        WHERE started_at >= ?
          AND agent != 'unknown'
        GROUP BY agent
      `).all(cutoff24h) as typeof runStatsRows

      statusRows = db.prepare(`
        SELECT DISTINCT agent, status
        FROM agent_runs
        WHERE started_at >= datetime('now', '-15 minutes')
          AND agent != 'unknown'
        ORDER BY started_at DESC
      `).all() as typeof statusRows

      // Edges: pairs of (parent_session agent → dispatched agent) via shared session_id
      // Approximation: same session_id within 24h — parent is the first-started agent
      edgeRows = db.prepare(`
        WITH session_agents AS (
          SELECT session_id, agent, MIN(started_at) AS first_start
          FROM agent_runs
          WHERE started_at >= ? AND agent != 'unknown'
          GROUP BY session_id, agent
        ),
        pairs AS (
          SELECT a.agent AS source, b.agent AS target, COUNT(*) AS dispatchCount24h, MAX(b.first_start) AS lastDispatchAt
          FROM session_agents a
          JOIN session_agents b ON a.session_id = b.session_id AND a.first_start < b.first_start
          GROUP BY a.agent, b.agent
        )
        SELECT * FROM pairs
        ORDER BY dispatchCount24h DESC
        LIMIT 100
      `).all(cutoff24h) as typeof edgeRows

      taskRows = db.prepare(`
        SELECT id, agent, task_summary, status, started_at, ended_at
        FROM agent_runs
        WHERE started_at >= ?
          AND agent != 'unknown'
        ORDER BY started_at DESC
        LIMIT 100
      `).all(cutoff1h) as typeof taskRows
    }

    // Build stat maps
    const runStatMap = new Map(runStatsRows.map(r => [r.agent, r]))
    const currentStatusMap = new Map<string, string>()
    for (const r of statusRows) {
      if (!currentStatusMap.has(r.agent)) {
        currentStatusMap.set(r.agent, r.status)
      }
    }

    // Merge registry with live stats — all 17 agents always present
    const nodes = CAST_AGENTS.map(agent => {
      const stats = runStatMap.get(agent.name)
      return {
        id:           agent.name,
        model:        agent.model,
        runCount24h:  stats?.runCount24h ?? 0,
        lastActiveAt: stats?.lastActiveAt ?? null,
        totalTokens:  (stats?.totalTokensIn ?? 0) + (stats?.totalTokensOut ?? 0),
        currentStatus: currentStatusMap.get(agent.name) ?? 'idle',
      }
    })

    const edges = edgeRows.map(r => ({
      source:          r.source,
      target:          r.target,
      dispatchCount24h: r.dispatchCount24h,
      lastDispatchAt:  r.lastDispatchAt,
    }))

    const tasks = taskRows.map(r => ({
      taskId:      r.id,
      parentAgent: r.agent,
      subject:     r.task_summary,
      status:      r.status,
      started_at:  r.started_at,
      ended_at:    r.ended_at,
    }))

    res.json({ nodes, edges, tasks })
  } catch (err) {
    console.error('Constellation graph error:', err)
    res.status(500).json({ error: 'Failed to fetch constellation graph' })
  }
})
