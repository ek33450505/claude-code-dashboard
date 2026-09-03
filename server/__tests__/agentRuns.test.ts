import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { agentRunsRouter, activeAgentsRouter, sessionAgentsRouter } = await import('../routes/agentRuns.js')

const runsApp = express()
runsApp.use('/', agentRunsRouter)
const activeApp = express()
activeApp.use('/', activeAgentsRouter)
const sessionAgentsApp = express()
sessionAgentsApp.use('/', sessionAgentsRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE agent_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, agent TEXT, model TEXT,
      started_at TEXT, ended_at TEXT, status TEXT, input_tokens INTEGER, output_tokens INTEGER,
      cost_usd REAL, agent_id TEXT, spawn_depth INTEGER, parent_agent_id TEXT
    );
    CREATE TABLE sessions (id TEXT PRIMARY KEY, project TEXT);
    CREATE TABLE dispatch_decisions (id INTEGER PRIMARY KEY, session_id TEXT, prompt_snippet TEXT, chosen_agent TEXT, created_at TEXT);
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('agent lineage columns (spawn_depth, parent_agent_id)', () => {
  it('GET /api/cast/agent-runs includes spawn_depth and parent_agent_id', async () => {
    testDb!.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, spawn_depth, parent_agent_id)
      VALUES ('sess-1', 'backend-writer', 'sonnet', '2026-08-01T00:00:00Z', 'DONE', 2, 'parent-abc')
    `).run()

    const res = await request(runsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(1)
    expect(res.body.runs[0].spawn_depth).toBe(2)
    expect(res.body.runs[0].parent_agent_id).toBe('parent-abc')

    // MUTATION CHECK (manually verified, not left in tree): remove
    // `ar.spawn_depth, ar.parent_agent_id,` from the SELECT list in agentRuns.ts —
    // both assertions above then read `undefined` and fail.
  })

  it('GET /api/cast/active-agents includes spawn_depth and parent_agent_id for a running row', async () => {
    testDb!.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, spawn_depth, parent_agent_id)
      VALUES ('sess-2', 'code-reviewer', 'haiku', datetime('now'), 'running', 1, 'parent-xyz')
    `).run()

    const res = await request(activeApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(1)
    expect(res.body.runs[0].spawn_depth).toBe(1)
    expect(res.body.runs[0].parent_agent_id).toBe('parent-xyz')
  })

  it('active-agents tolerates NULL spawn_depth/parent_agent_id (expected for a top-level run, D16)', async () => {
    testDb!.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status)
      VALUES ('sess-3', 'planner', 'sonnet', datetime('now'), 'running')
    `).run()

    const res = await request(activeApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs[0].spawn_depth).toBeNull()
    expect(res.body.runs[0].parent_agent_id).toBeNull()
  })

  it('GET /api/cast/session-agents/:sessionId includes spawn_depth and parent_agent_id', async () => {
    testDb!.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, spawn_depth, parent_agent_id)
      VALUES ('sess-4', 'backend-writer', 'sonnet', '2026-08-01T00:00:00Z', 'DONE', 3, 'parent-def')
    `).run()

    const res = await request(sessionAgentsApp).get('/sess-4')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(1)
    expect(res.body.runs[0].spawn_depth).toBe(3)
    expect(res.body.runs[0].parent_agent_id).toBe('parent-def')

    // MUTATION CHECK (manually verified, not left in tree): remove
    // `ar.spawn_depth, ar.parent_agent_id,` from the sessionAgentsRouter SELECT list —
    // both assertions above then read `undefined` and fail.
  })
})
