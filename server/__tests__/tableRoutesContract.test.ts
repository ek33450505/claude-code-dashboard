/**
 * Factory router contract tests for four untested routes.
 *
 * Covers:
 * 1. GET /api/agent-truncations — { truncations } envelope, fixed limit of 50
 * 2. GET /api/incidents — { incidents } envelope, ordered by occurred_at DESC
 * 3. GET /api/rate-limits — { latest, snapshots } envelope, custom respond function
 * 4. GET /api/eval-runs — { runs } envelope, default limit 200, max 1000
 *
 * Each test:
 * - Seeds a fixture table with EXACT columns from shared/castSchema.ts (canonical contract)
 * - Verifies the route returns 200 with correct envelope key
 * - Asserts rows round-trip actual field values (catches column-name typos)
 * - Tests ordering (DESC on primary time column)
 * - Tests missing table → 200 with empty envelope
 * - Tests getCastDb() null → 200 with empty envelope
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Shared in-memory database
// ---------------------------------------------------------------------------
let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

// ---------------------------------------------------------------------------
// Import routes after mock is in place
// ---------------------------------------------------------------------------
const { agentTruncationsRouter } = await import('../routes/agentTruncations.js')
const { incidentsRouter } = await import('../routes/incidents.js')
const { rateLimitsRouter } = await import('../routes/rateLimits.js')
const { evalRunsRouter } = await import('../routes/evalRuns.js')

// ---------------------------------------------------------------------------
// Apps
// ---------------------------------------------------------------------------
const agentTruncationsApp = express()
agentTruncationsApp.use(express.json())
agentTruncationsApp.use('/', agentTruncationsRouter)

const incidentsApp = express()
incidentsApp.use(express.json())
incidentsApp.use('/', incidentsRouter)

const rateLimitsApp = express()
rateLimitsApp.use(express.json())
rateLimitsApp.use('/', rateLimitsRouter)

const evalRunsApp = express()
evalRunsApp.use(express.json())
evalRunsApp.use('/', evalRunsRouter)

// ---------------------------------------------------------------------------
// Database creators with exact schema columns from castSchema.ts
// ---------------------------------------------------------------------------

function createAgentTruncationsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE agent_truncations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      agent_type TEXT,
      agent_id TEXT,
      last_line TEXT,
      timestamp TEXT NOT NULL,
      char_count INTEGER,
      partial_work_log TEXT
    )
  `)
  return db
}

function createIncidentsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE incidents (
      id TEXT PRIMARY KEY,
      occurred_at TEXT NOT NULL,
      problem_summary TEXT,
      fix_summary TEXT,
      related_files TEXT,
      related_commit TEXT,
      resolution_status TEXT,
      surfaced_by TEXT
    )
  `)
  return db
}

function createRateLimitsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE rate_limit_snapshots (
      ts INTEGER NOT NULL,
      tpm_limit INTEGER,
      tpm_used INTEGER,
      rpm_limit INTEGER,
      rpm_used INTEGER,
      raw_json TEXT
    )
  `)
  return db
}

function createEvalRunsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eval_id TEXT,
      agent TEXT,
      attempt INTEGER,
      agent_run_id TEXT,
      status TEXT,
      grader_results TEXT,
      pass_at_k INTEGER,
      k INTEGER,
      duration_ms INTEGER,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      model TEXT,
      cost_tier TEXT
    )
  `)
  return db
}

// ===========================================================================
// 1. GET /api/agent-truncations
// ===========================================================================

describe('GET /api/agent-truncations', () => {
  beforeEach(() => {
    testDb = createAgentTruncationsDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns 200 with correct { truncations } envelope when table does not exist', async () => {
    testDb = new Database(':memory:') // no table

    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('truncations')
    expect(Array.isArray(res.body.truncations)).toBe(true)
    expect(res.body.truncations).toEqual([])
  })

  it('returns 200 with correct { truncations } envelope when getCastDb returns null', async () => {
    testDb = null

    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('truncations')
    expect(Array.isArray(res.body.truncations)).toBe(true)
    expect(res.body.truncations).toEqual([])
  })

  it('returns 200 with an empty truncations array when the table exists but has no rows', async () => {
    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('truncations')
    expect(res.body.truncations).toEqual([])
  })

  it('returns entries ordered by timestamp DESC', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO agent_truncations (session_id, agent_type, agent_id, last_line, timestamp, char_count, partial_work_log) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert out of order
    insert.run('sess-1', 'backend-writer', 'id-1', 'line 1', '2026-05-01T10:00:00Z', 100, null)
    insert.run('sess-2', 'frontend-writer', 'id-2', 'line 2', '2026-05-01T12:00:00Z', 200, 'partial')
    insert.run('sess-3', 'code-reviewer', 'id-3', 'line 3', '2026-05-01T11:00:00Z', 150, null)

    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.truncations).toHaveLength(3)
    // Ordered DESC: most recent first
    expect(res.body.truncations[0].timestamp).toBe('2026-05-01T12:00:00Z')
    expect(res.body.truncations[0].agent_type).toBe('frontend-writer')
    expect(res.body.truncations[0].char_count).toBe(200)
    expect(res.body.truncations[0].partial_work_log).toBe('partial')

    expect(res.body.truncations[1].timestamp).toBe('2026-05-01T11:00:00Z')
    expect(res.body.truncations[1].agent_type).toBe('code-reviewer')
    expect(res.body.truncations[1].char_count).toBe(150)

    expect(res.body.truncations[2].timestamp).toBe('2026-05-01T10:00:00Z')
    expect(res.body.truncations[2].agent_type).toBe('backend-writer')
    expect(res.body.truncations[2].char_count).toBe(100)
  })

  it('enforces fixed limit of 50 (seed 51+ rows, assert exactly 50 returned)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO agent_truncations (session_id, agent_type, agent_id, last_line, timestamp, char_count, partial_work_log) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert 60 rows
    for (let i = 0; i < 60; i++) {
      const timestamp = new Date(new Date('2026-05-01T00:00:00Z').getTime() + i * 60000).toISOString()
      insert.run(`sess-${i}`, `agent-${i}`, `id-${i}`, `line ${i}`, timestamp, i * 10, `log-${i}`)
    }

    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.truncations).toHaveLength(50)
    // Verify field values: first row should be the most recent (i=59)
    expect(res.body.truncations[0].agent_type).toBe('agent-59')
    expect(res.body.truncations[0].char_count).toBe(590)
    expect(res.body.truncations[0].partial_work_log).toBe('log-59')
  })

  it('ignores ?limit=999 query parameter (fixed limit of 50 cannot be overridden)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO agent_truncations (session_id, agent_type, agent_id, last_line, timestamp, char_count, partial_work_log) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert 60 rows
    for (let i = 0; i < 60; i++) {
      const timestamp = new Date(new Date('2026-05-01T00:00:00Z').getTime() + i * 60000).toISOString()
      insert.run(`sess-${i}`, `agent-${i}`, `id-${i}`, `line ${i}`, timestamp, i * 10, `log-${i}`)
    }

    // Try to override with ?limit=999
    const res = await request(agentTruncationsApp).get('/?limit=999')

    expect(res.status).toBe(200)
    // Still 50, not 60 or 999
    expect(res.body.truncations).toHaveLength(50)
    // Verify field values to ensure rows are real, not empty objects
    expect(res.body.truncations[0].agent_type).toBe('agent-59')
    expect(res.body.truncations[0].char_count).toBe(590)
    expect(res.body.truncations[49].agent_type).toBe('agent-10')
    expect(res.body.truncations[49].char_count).toBe(100)
  })

  it('rounds-trip all field values correctly', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO agent_truncations (session_id, agent_type, agent_id, last_line, timestamp, char_count, partial_work_log) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )

    insert.run('test-session-123', 'test-agent-type', 'test-agent-id', 'test line content', '2026-09-02T15:30:45Z', 42, 'test partial log')

    const res = await request(agentTruncationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.truncations).toHaveLength(1)
    const row = res.body.truncations[0]
    expect(row.id).toBeDefined()
    expect(row.session_id).toBe('test-session-123')
    expect(row.agent_type).toBe('test-agent-type')
    expect(row.agent_id).toBe('test-agent-id')
    expect(row.last_line).toBe('test line content')
    expect(row.timestamp).toBe('2026-09-02T15:30:45Z')
    expect(row.char_count).toBe(42)
    expect(row.partial_work_log).toBe('test partial log')
  })
})

// ===========================================================================
// 2. GET /api/incidents
// ===========================================================================

describe('GET /api/incidents', () => {
  beforeEach(() => {
    testDb = createIncidentsDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns 200 with correct { incidents } envelope when table does not exist', async () => {
    testDb = new Database(':memory:') // no table

    const res = await request(incidentsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('incidents')
    expect(Array.isArray(res.body.incidents)).toBe(true)
    expect(res.body.incidents).toEqual([])
  })

  it('returns 200 with correct { incidents } envelope when getCastDb returns null', async () => {
    testDb = null

    const res = await request(incidentsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('incidents')
    expect(Array.isArray(res.body.incidents)).toBe(true)
    expect(res.body.incidents).toEqual([])
  })

  it('returns 200 with an empty incidents array when the table exists but has no rows', async () => {
    const res = await request(incidentsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('incidents')
    expect(res.body.incidents).toEqual([])
  })

  it('returns entries ordered by occurred_at DESC', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO incidents (id, occurred_at, problem_summary, fix_summary, related_files, related_commit, resolution_status, surfaced_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert out of order
    insert.run('inc-1', '2026-05-01T10:00:00Z', 'problem 1', 'fix 1', 'file1.ts', 'abc123', 'resolved', 'user-1')
    insert.run('inc-2', '2026-05-01T12:00:00Z', 'problem 2', 'fix 2', 'file2.ts', 'def456', 'open', 'user-2')
    insert.run('inc-3', '2026-05-01T11:00:00Z', 'problem 3', null, null, null, null, null)

    const res = await request(incidentsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.incidents).toHaveLength(3)
    // Ordered DESC: most recent first
    expect(res.body.incidents[0].occurred_at).toBe('2026-05-01T12:00:00Z')
    expect(res.body.incidents[0].problem_summary).toBe('problem 2')
    expect(res.body.incidents[0].fix_summary).toBe('fix 2')
    expect(res.body.incidents[0].related_files).toBe('file2.ts')

    expect(res.body.incidents[1].occurred_at).toBe('2026-05-01T11:00:00Z')
    expect(res.body.incidents[1].problem_summary).toBe('problem 3')
    expect(res.body.incidents[1].fix_summary).toBeNull()

    expect(res.body.incidents[2].occurred_at).toBe('2026-05-01T10:00:00Z')
    expect(res.body.incidents[2].problem_summary).toBe('problem 1')
  })

  it('rounds-trip all field values correctly', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO incidents (id, occurred_at, problem_summary, fix_summary, related_files, related_commit, resolution_status, surfaced_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )

    insert.run('test-id-001', '2026-09-02T14:22:33Z', 'test problem', 'test fix', 'test/file.ts', 'abc1234567', 'resolved', 'test-user')

    const res = await request(incidentsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.incidents).toHaveLength(1)
    const row = res.body.incidents[0]
    expect(row.id).toBe('test-id-001')
    expect(row.occurred_at).toBe('2026-09-02T14:22:33Z')
    expect(row.problem_summary).toBe('test problem')
    expect(row.fix_summary).toBe('test fix')
    expect(row.related_files).toBe('test/file.ts')
    expect(row.related_commit).toBe('abc1234567')
    expect(row.resolution_status).toBe('resolved')
    expect(row.surfaced_by).toBe('test-user')
  })
})

// ===========================================================================
// 3. GET /api/rate-limits
// ===========================================================================

describe('GET /api/rate-limits', () => {
  beforeEach(() => {
    testDb = createRateLimitsDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns 200 with { latest: null, snapshots: [] } when table does not exist', async () => {
    testDb = new Database(':memory:') // no table

    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('latest')
    expect(res.body).toHaveProperty('snapshots')
    expect(res.body.latest).toBeNull()
    expect(Array.isArray(res.body.snapshots)).toBe(true)
    expect(res.body.snapshots).toEqual([])
  })

  it('returns 200 with { latest: null, snapshots: [] } when getCastDb returns null', async () => {
    testDb = null

    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('latest')
    expect(res.body).toHaveProperty('snapshots')
    expect(res.body.latest).toBeNull()
    expect(res.body.snapshots).toEqual([])
  })

  it('returns { latest: null, snapshots: [] } when table exists and is empty', async () => {
    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.latest).toBeNull()
    expect(res.body.snapshots).toEqual([])
  })

  it('returns entries ordered by ts DESC', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO rate_limit_snapshots (ts, tpm_limit, tpm_used, rpm_limit, rpm_used, raw_json) VALUES (?, ?, ?, ?, ?, ?)'
    )

    // Insert out of order by timestamp
    insert.run(1000, 90000, 45000, 3200, 1600, '{}')
    insert.run(3000, 90000, 60000, 3200, 2400, '{}')
    insert.run(2000, 90000, 50000, 3200, 2000, '{}')

    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.snapshots)).toBe(true)
    expect(res.body.snapshots).toHaveLength(3)
    // Ordered DESC: most recent (highest ts) first
    expect(res.body.snapshots[0].ts).toBe(3000)
    expect(res.body.snapshots[0].tpm_used).toBe(60000)

    expect(res.body.snapshots[1].ts).toBe(2000)
    expect(res.body.snapshots[1].tpm_used).toBe(50000)

    expect(res.body.snapshots[2].ts).toBe(1000)
    expect(res.body.snapshots[2].tpm_used).toBe(45000)
  })

  it('sets latest to the FIRST row of snapshots (newest by ts DESC)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO rate_limit_snapshots (ts, tpm_limit, tpm_used, rpm_limit, rpm_used, raw_json) VALUES (?, ?, ?, ?, ?, ?)'
    )

    insert.run(1000, 90000, 10000, 3200, 500, '{}')
    insert.run(3000, 90000, 30000, 3200, 1500, '{}')
    insert.run(2000, 90000, 20000, 3200, 1000, '{}')

    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.latest).not.toBeNull()
    expect(res.body.latest).toEqual(res.body.snapshots[0])
    // latest should be the most recent (ts=3000)
    expect(res.body.latest.ts).toBe(3000)
    expect(res.body.latest.tpm_used).toBe(30000)
  })

  it('respects default limit (100) and max limit (500)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO rate_limit_snapshots (ts, tpm_limit, tpm_used, rpm_limit, rpm_used, raw_json) VALUES (?, ?, ?, ?, ?, ?)'
    )

    // Insert 600 rows to test both default and max clamping
    for (let i = 0; i < 600; i++) {
      insert.run(i, 90000, i * 100, 3200, i, '{}')
    }

    // No limit parameter: should return default 100
    const res1 = await request(rateLimitsApp).get('/')
    expect(res1.status).toBe(200)
    expect(res1.body.snapshots).toHaveLength(100)
    // Verify latest is the newest row (highest ts = 599)
    expect(res1.body.latest).not.toBeNull()
    expect(res1.body.latest.ts).toBe(599)
    expect(res1.body.latest.tpm_used).toBe(59900)
    // First snapshot should also be the newest (DESC order)
    expect(res1.body.snapshots[0]).toEqual(res1.body.latest)

    // ?limit=50: should return 50
    const res2 = await request(rateLimitsApp).get('/?limit=50')
    expect(res2.status).toBe(200)
    expect(res2.body.snapshots).toHaveLength(50)
    expect(res2.body.latest).not.toBeNull()
    expect(res2.body.latest.ts).toBe(599)
    expect(res2.body.latest.tpm_used).toBe(59900)

    // ?limit=600: should be clamped to max 500
    const res3 = await request(rateLimitsApp).get('/?limit=600')
    expect(res3.status).toBe(200)
    expect(res3.body.snapshots).toHaveLength(500)
    expect(res3.body.latest).not.toBeNull()
    expect(res3.body.latest.ts).toBe(599)
    expect(res3.body.latest.tpm_used).toBe(59900)
  })

  it('rounds-trip all selected field values correctly', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO rate_limit_snapshots (ts, tpm_limit, tpm_used, rpm_limit, rpm_used, raw_json) VALUES (?, ?, ?, ?, ?, ?)'
    )

    insert.run(1725283200, 100000, 75000, 3600, 2500, '{"unused":"field"}')

    const res = await request(rateLimitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.snapshots).toHaveLength(1)
    const row = res.body.snapshots[0]
    // Route selects: ts, tpm_limit, tpm_used, rpm_limit, rpm_used
    expect(row.ts).toBe(1725283200)
    expect(row.tpm_limit).toBe(100000)
    expect(row.tpm_used).toBe(75000)
    expect(row.rpm_limit).toBe(3600)
    expect(row.rpm_used).toBe(2500)

    // Verify latest is set correctly
    expect(res.body.latest).toEqual(row)
  })
})

// ===========================================================================
// 4. GET /api/eval-runs
// ===========================================================================

describe('GET /api/eval-runs', () => {
  beforeEach(() => {
    testDb = createEvalRunsDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns 200 with correct { runs } envelope when table does not exist', async () => {
    testDb = new Database(':memory:') // no table

    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('runs')
    expect(Array.isArray(res.body.runs)).toBe(true)
    expect(res.body.runs).toEqual([])
  })

  it('returns 200 with correct { runs } envelope when getCastDb returns null', async () => {
    testDb = null

    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('runs')
    expect(Array.isArray(res.body.runs)).toBe(true)
    expect(res.body.runs).toEqual([])
  })

  it('returns 200 with an empty runs array when the table exists but has no rows', async () => {
    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('runs')
    expect(res.body.runs).toEqual([])
  })

  it('returns entries ordered by started_at DESC', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO eval_runs (eval_id, agent, attempt, agent_run_id, status, grader_results, pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert out of order by started_at
    insert.run('eval-1', 'backend-writer', 1, 'run-1', 'pass', null, null, null, 1000, '2026-05-01T10:00:00.000000+00:00', null, 'claude-opus-5', null)
    insert.run('eval-2', 'frontend-writer', 2, 'run-2', 'fail', '{"score":0.5}', 1, 5, 2000, '2026-05-01T12:00:00.000000+00:00', '2026-05-01T12:01:00.000000+00:00', 'claude-sonnet-5', 'B')
    insert.run('eval-3', 'code-reviewer', 1, 'run-3', 'pass', null, 3, 10, 1500, '2026-05-01T11:00:00.000000+00:00', null, 'claude-opus-5', 'A')

    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(3)
    // Ordered DESC: most recent first
    expect(res.body.runs[0].started_at).toBe('2026-05-01T12:00:00.000000+00:00')
    expect(res.body.runs[0].agent).toBe('frontend-writer')
    expect(res.body.runs[0].status).toBe('fail')

    expect(res.body.runs[1].started_at).toBe('2026-05-01T11:00:00.000000+00:00')
    expect(res.body.runs[1].agent).toBe('code-reviewer')
    expect(res.body.runs[1].status).toBe('pass')

    expect(res.body.runs[2].started_at).toBe('2026-05-01T10:00:00.000000+00:00')
    expect(res.body.runs[2].agent).toBe('backend-writer')
    expect(res.body.runs[2].status).toBe('pass')
  })

  it('enforces default limit of 200 (seed 250+ rows, assert exactly 200 returned)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO eval_runs (eval_id, agent, attempt, agent_run_id, status, grader_results, pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert 250 rows
    for (let i = 0; i < 250; i++) {
      const timestamp = new Date(new Date('2026-05-01T00:00:00Z').getTime() + i * 1000).toISOString()
      insert.run(`eval-${i}`, `agent-${i}`, i, `run-${i}`, i % 2 === 0 ? 'pass' : 'fail', null, null, null, i * 100, timestamp, null, 'claude-opus-5', null)
    }

    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(200)
    // Verify field values: first row should be the most recent (i=249)
    expect(res.body.runs[0].agent).toBe('agent-249')
    expect(res.body.runs[0].duration_ms).toBe(24900)
    // i=249: 249 % 2 === 1, so status is 'fail'
    expect(res.body.runs[0].status).toBe('fail')
  })

  it('respects default limit (200) and max limit (1000)', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO eval_runs (eval_id, agent, attempt, agent_run_id, status, grader_results, pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    // Insert 1200 rows to test both default and max clamping
    for (let i = 0; i < 1200; i++) {
      const timestamp = new Date(new Date('2026-05-01T00:00:00Z').getTime() + i * 1000).toISOString()
      insert.run(`eval-${i}`, `agent-${i}`, 1, `run-${i}`, 'pass', null, null, null, i, timestamp, null, 'claude-opus-5', null)
    }

    // No limit parameter: should return default 200
    const res1 = await request(evalRunsApp).get('/')
    expect(res1.status).toBe(200)
    expect(res1.body.runs).toHaveLength(200)
    // First row should be the newest (i=1199)
    expect(res1.body.runs[0].agent).toBe('agent-1199')

    // ?limit=500: should return 500
    const res2 = await request(evalRunsApp).get('/?limit=500')
    expect(res2.status).toBe(200)
    expect(res2.body.runs).toHaveLength(500)

    // ?limit=1200: should be clamped to max 1000
    const res3 = await request(evalRunsApp).get('/?limit=1200')
    expect(res3.status).toBe(200)
    expect(res3.body.runs).toHaveLength(1000)

    // ?limit=-1: should return DEFAULT (200), not unlimited
    const res4 = await request(evalRunsApp).get('/?limit=-1')
    expect(res4.status).toBe(200)
    expect(res4.body.runs).toHaveLength(200)
  })

  it('rounds-trip all field values correctly', async () => {
    const insert = testDb!.prepare(
      'INSERT INTO eval_runs (eval_id, agent, attempt, agent_run_id, status, grader_results, pass_at_k, k, duration_ms, started_at, ended_at, model, cost_tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    insert.run('test-eval-001', 'test-agent', 42, 'test-run-id', 'pass', '{"test":"data"}', 3, 10, 5678, '2026-09-02T15:30:45.123456+00:00', '2026-09-02T15:35:45.123456+00:00', 'claude-opus-5', 'A')

    const res = await request(evalRunsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.runs).toHaveLength(1)
    const row = res.body.runs[0]
    expect(row.id).toBeDefined()
    expect(row.eval_id).toBe('test-eval-001')
    expect(row.agent).toBe('test-agent')
    expect(row.attempt).toBe(42)
    expect(row.agent_run_id).toBe('test-run-id')
    expect(row.status).toBe('pass')
    expect(row.grader_results).toBe('{"test":"data"}')
    expect(row.pass_at_k).toBe(3)
    expect(row.k).toBe(10)
    expect(row.duration_ms).toBe(5678)
    expect(row.started_at).toBe('2026-09-02T15:30:45.123456+00:00')
    expect(row.ended_at).toBe('2026-09-02T15:35:45.123456+00:00')
    expect(row.model).toBe('claude-opus-5')
    expect(row.cost_tier).toBe('A')
  })
})
