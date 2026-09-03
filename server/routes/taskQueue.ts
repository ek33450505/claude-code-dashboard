import { Router } from 'express'
import Database from 'better-sqlite3'
import { getCastDb, getCastDbWritable } from './castDb.js'
import { CAST_DB } from '../constants.js'
import { redactPath } from '../utils/projectKey.js'
import fs from 'fs'

export const taskQueueRouter = Router()

type SyntheticTask = {
  id: string; agent: string; priority: number; status: string; created_at: string;
  retry_count: number; scheduled_for: null; result_summary: string; task: string
}

function mapAgentRunStatus(s: string): string {
  if (s === 'running') return 'claimed'
  if (s === 'done' || s === 'DONE' || s === 'DONE_WITH_CONCERNS') return 'done'
  if (s === 'BLOCKED' || s === 'failed') return 'failed'
  return 'pending'
}

/** Build the agent_runs-derived synthetic task list used when task_queue is absent (site A)
 *  or present but has no active work (site B) — see the two call sites in GET /. Throws if
 *  agent_runs itself doesn't exist; callers catch that and fall back further, and each site's
 *  fallback-of-the-fallback differs (empty response vs. falling through to the task_queue
 *  result), so that catch stays at the call site rather than inside this helper. */
function buildAgentRunsFallback(db: ReturnType<typeof Database>): { tasks: SyntheticTask[]; counts: Record<string, number> } {
  const agentRuns = db.prepare(`
    SELECT id, agent, model, status, started_at, ended_at
    FROM agent_runs
    ORDER BY started_at DESC
    LIMIT 20
  `).all() as Array<{
    id: number; agent: string; model: string; status: string;
    started_at: string; ended_at: string | null
  }>

  const syntheticTasks: SyntheticTask[] = agentRuns.map(r => ({
    id: String(r.id),
    agent: r.agent,
    priority: 0,
    status: mapAgentRunStatus(r.status),
    created_at: r.started_at,
    retry_count: 0,
    // Synthesized, NOT the dropped DB columns of the same name: the fallback derives
    // these from agent_runs. taskQueue.test.ts:204-213 asserts they are present here,
    // while :158 asserts the primary path omits result_summary — the asymmetry is the
    // contract, not an oversight.
    scheduled_for: null,
    result_summary: r.status,
    task: `Agent run: ${r.agent}`,
  }))

  const syntheticCounts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
  for (const t of syntheticTasks) {
    if (t.status in syntheticCounts) syntheticCounts[t.status]++
  }

  return { tasks: syntheticTasks, counts: syntheticCounts }
}

taskQueueRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        tasks: [],
        counts: { pending: 0, claimed: 0, done: 0, failed: 0 },
      })
    }

    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='task_queue'"
    ).get()
    if (!tableCheck) {
      // task_queue table absent — fall through to agent_runs fallback
      try {
        const fallback = buildAgentRunsFallback(db)
        return res.json({ tasks: fallback.tasks, counts: fallback.counts, source: 'agent_runs' })
      } catch {
        // agent_runs also absent
        return res.json({
          tasks: [],
          counts: { pending: 0, claimed: 0, done: 0, failed: 0 },
        })
      }
    }

    // result_summary AND scheduled_for were both dropped from the canonical task_queue
    // schema by migration 028. Selecting either throws at prepare(), which the catch below
    // turns into an empty response — so this route returned nothing at all until 2026-09-01.
    const tasks = db.prepare(`
      SELECT
        id, agent, priority, status, created_at, retry_count, task
      FROM task_queue
      ORDER BY priority ASC, created_at DESC
    `).all() as Array<{
      id: string; agent: string; priority: number; status: string;
      created_at: string; retry_count: number;
      task: string | null
    }>

    const countsRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM task_queue GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>

    const counts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
    for (const r of countsRows) {
      if (r.status in counts) counts[r.status] = r.cnt
    }

    // If task_queue has no active work, fall back to agent_runs for display
    if (counts.pending + counts.claimed === 0) {
      try {
        const fallback = buildAgentRunsFallback(db)
        return res.json({ tasks: fallback.tasks, counts: fallback.counts, source: 'agent_runs' })
      } catch {
        // agent_runs table may not exist; fall through to empty task_queue response
      }
    }

    // task is free-text / producer-polymorphic — some writers (e.g. control.ts's
    // dispatch endpoint) embed an absolute filesystem path (a real dispatch-log
    // path under ~/.claude/) inside the JSON-stringified value. redactPath() does
    // substring replacement, not JSON parsing, so it finds and masks the leaked
    // path wherever it sits in the string without needing to know task's shape.
    res.json({ tasks: tasks.map(t => ({ ...t, task: redactPath(t.task) })), counts })
  } catch (err) {
    console.error('Task queue error:', err)
    res.status(500).json({ error: 'Failed to fetch task queue' })
  }
})

taskQueueRouter.delete('/:id', (req, res) => {
  const { id } = req.params
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid task id' })
  }
  if (!fs.existsSync(CAST_DB)) {
    return res.status(404).json({ error: 'cast.db not found' })
  }
  let db: ReturnType<typeof Database> | null = null
  try {
    db = getCastDbWritable()
    if (!db) {
      return res.status(404).json({ error: 'cast.db not found' })
    }
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='task_queue'"
    ).get()
    if (!tableCheck) {
      return res.status(404).json({ error: 'Task not found' })
    }
    const result = db.prepare('DELETE FROM task_queue WHERE id = ?').run(id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ success: true, deleted: id })
  } catch (err) {
    console.error('Delete task error:', err)
    res.status(500).json({ error: 'Failed to delete task' })
  } finally {
    if (db) db.close()
  }
})
