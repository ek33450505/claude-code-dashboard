import { Router } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getCastDb } from './castDb.js'
import { CAST_REPO_DIR } from '../constants.js'
import { relativizeHome } from '../utils/relativizeHome.js'
import { taskSummarySubquery } from '../utils/taskSummary.js'
import { clampLimit } from '../utils/clampLimit.js'

const execFileAsync = promisify(execFile)

export const agentRunsRouter = Router()

/**
 * An agent_run counts as "active" only when status='running' AND it started within
 * this window. Bounds staleness: orphan 'running' rows (agents that crashed or hit
 * maxTurns without firing SubagentStop, so were never flipped to DONE) fall outside
 * the window and are excluded. Single source of the active-agent threshold.
 */
export const ACTIVE_AGENT_WINDOW_MINUTES = 15

// Separate router for GET /api/cast/active-agents (mounted at '/cast/active-agents')
// so the path resolves to '/' when Express strips the prefix.
export const activeAgentsRouter = Router()

// Router for session-specific agent history and worktree status
export const sessionAgentsRouter = Router()
export const worktreesRouter = Router()

// GET /api/cast/active-agents
// Returns only agents currently running, after deduplicating SubagentStart/SubagentStop
// pairs using a window function that picks the highest-priority status per
// (agent, 5-minute bucket). Filters out phantom 'unknown' agent rows.
activeAgentsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ runs: [] })
    }

    const runs = db.prepare(`
      WITH ranked AS (
        SELECT
          ar.id,
          ar.session_id,
          ar.agent,
          ar.model,
          ar.started_at,
          ar.ended_at,
          ar.status,
          ar.input_tokens,
          ar.output_tokens,
          ar.cost_usd,
          ar.spawn_depth,
          ar.parent_agent_id,
          ${taskSummarySubquery(db)},
          s.project,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(ar.agent_id, CAST(ar.id AS TEXT))
            ORDER BY
              CASE ar.status
                WHEN 'DONE' THEN 1
                WHEN 'DONE_WITH_CONCERNS' THEN 2
                WHEN 'BLOCKED' THEN 3
                ELSE 4
              END,
              ar.started_at DESC
          ) AS rn
        FROM agent_runs ar
        LEFT JOIN sessions s ON s.id = ar.session_id
        WHERE ar.agent != 'unknown'
      )
      SELECT
        id, session_id, agent, model, started_at, ended_at,
        status, input_tokens, output_tokens, cost_usd,
        spawn_depth, parent_agent_id,
        task_summary, project
      FROM ranked
      WHERE rn = 1
        AND status = 'running'
        AND unixepoch(started_at) >= unixepoch('now', '-${ACTIVE_AGENT_WINDOW_MINUTES} minutes')
      ORDER BY started_at DESC
    `).all() as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      // NULL by construction for a still-running row (D16) — not a bug.
      spawn_depth: number | null; parent_agent_id: string | null;
      task_summary: string | null; project: string | null
    }>

    res.json({ runs })
  } catch (err) {
    console.error('Active agents error:', err)
    res.status(500).json({ error: 'Failed to fetch active agents' })
  }
})

agentRunsRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        runs: [],
        stats: { totalRuns: 0, totalCostUsd: 0, byAgent: {}, byStatus: {} },
      })
    }

    const limit = clampLimit(req.query.limit, 100, 500)
    const agent = req.query.agent as string | undefined
    const status = req.query.status as string | undefined
    const since = req.query.since as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('ar.agent = ?'); params.push(agent) }
    if (status) { conditions.push('ar.status = ?'); params.push(status) }
    if (since) { conditions.push('ar.started_at >= ?'); params.push(since) }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const runs = db.prepare(`
      SELECT
        ar.id,
        ar.session_id,
        ar.agent,
        ar.model,
        ar.started_at,
        ar.ended_at,
        ar.status,
        ar.input_tokens,
        ar.output_tokens,
        ar.cost_usd,
        ar.spawn_depth,
        ar.parent_agent_id,
        ${taskSummarySubquery(db)},
        ar.agent_id,
        s.project
      FROM agent_runs ar
      LEFT JOIN sessions s ON s.id = ar.session_id
      ${where}
      ORDER BY ar.started_at DESC
      LIMIT ?
    `).all([...params, limit]) as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      spawn_depth: number | null; parent_agent_id: string | null;
      task_summary: string | null; project: string | null;
      agent_id: string | null
    }>

    // Aggregate stats — apply the same filters as the list query so stat cards match
    const statsRow = db.prepare(`
      SELECT
        COUNT(*) AS totalRuns,
        COALESCE(SUM(cost_usd), 0) AS totalCostUsd
      FROM agent_runs ar
      ${where}
    `).get(...params) as { totalRuns: number; totalCostUsd: number }

    const byAgentRows = db.prepare(`
      SELECT agent, COUNT(*) AS cnt FROM agent_runs ar ${where} GROUP BY agent
    `).all(...params) as Array<{ agent: string; cnt: number }>

    const byStatusRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM agent_runs ar ${where} GROUP BY status
    `).all(...params) as Array<{ status: string; cnt: number }>

    const byAgent: Record<string, number> = {}
    for (const r of byAgentRows) byAgent[r.agent] = r.cnt

    const byStatus: Record<string, number> = {}
    for (const r of byStatusRows) byStatus[r.status] = r.cnt

    res.json({
      runs,
      stats: {
        totalRuns: statsRow.totalRuns,
        totalCostUsd: statsRow.totalCostUsd,
        byAgent,
        byStatus,
      },
    })
  } catch (err) {
    console.error('Agent runs error:', err)
    res.status(500).json({ error: 'Failed to fetch agent runs' })
  }
})

// GET /api/cast/session-agents/:sessionId
// Returns all agent_runs for a given session, ordered by started_at
sessionAgentsRouter.get('/:sessionId', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ runs: [] })
    }

    const { sessionId } = req.params

    const runs = db.prepare(`
      SELECT
        ar.id,
        ar.session_id,
        ar.agent,
        ar.model,
        ar.started_at,
        ar.ended_at,
        ar.status,
        ar.input_tokens,
        ar.output_tokens,
        ar.cost_usd,
        ${taskSummarySubquery(db)},
        ar.agent_id,
        ar.spawn_depth,
        ar.parent_agent_id,
        s.project,
        CASE
          WHEN ar.ended_at IS NOT NULL
          THEN CAST((julianday(ar.ended_at) - julianday(ar.started_at)) * 86400000 AS INTEGER)
          ELSE NULL
        END AS duration_ms
      FROM agent_runs ar
      LEFT JOIN sessions s ON s.id = ar.session_id
      WHERE ar.session_id = ?
      ORDER BY ar.started_at ASC
    `).all(sessionId) as Array<{
      id: string; session_id: string; agent: string; model: string;
      started_at: string; ended_at: string | null; status: string;
      input_tokens: number; output_tokens: number; cost_usd: number;
      task_summary: string | null; project: string | null; duration_ms: number | null;
      agent_id: string | null; spawn_depth: number | null; parent_agent_id: string | null
    }>

    res.json({ runs })
  } catch (err) {
    console.error('Session agents error:', err)
    res.status(500).json({ error: 'Failed to fetch session agents' })
  }
})

// GET /api/cast/worktrees
// Returns parsed output of `git worktree list --porcelain`, run against CAST_REPO_DIR
// (the flagship checkout) rather than the dashboard's own cwd — previously this ran
// with no `cwd` at all, so it silently returned the DASHBOARD's worktrees while the UI
// presented them as CAST agent worktrees (D8). Uses the async execFile (no shell, so
// no need for the old `2>/dev/null || true` fragment — a non-zero exit just rejects
// the promise, caught below) instead of the synchronous execSync, which blocked the
// event loop for up to 5s on this public, unauthenticated GET (S4).
worktreesRouter.get('/', async (_req, res) => {
  try {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: CAST_REPO_DIR,
      encoding: 'utf-8',
      timeout: 5000,
    })

    const worktrees: Array<{
      path: string
      branch: string | null
      head: string
    }> = []

    let current: { path: string; branch: string | null; head: string } | null = null

    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current) worktrees.push(current)
        // `git worktree list --porcelain` prints absolute paths — relativize on the
        // way out (S4: this GET is public/unauthenticated). Nothing downstream
        // reuses `current.path` for I/O — it's parsed straight from git's stdout
        // and only ever pushed into the response array.
        current = { path: relativizeHome(line.slice(9))!, branch: null, head: '' }
      } else if (line.startsWith('HEAD ') && current) {
        current.head = line.slice(5)
      } else if (line.startsWith('branch ') && current) {
        current.branch = line.slice(7).replace('refs/heads/', '')
      }
    }
    if (current) worktrees.push(current)

    res.json({ worktrees })
  } catch (err) {
    console.error('Worktrees error:', err)
    res.json({ worktrees: [] })
  }
})
