import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ── Test DB setup ──────────────────────────────────────────────────────────────

let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  db.exec(`
    CREATE TABLE agent_runs (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id   TEXT,
      agent        TEXT NOT NULL,
      model        TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      cost_usd     REAL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0
    );

    CREATE TABLE budgets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      scope        TEXT,
      scope_key    TEXT,
      period       TEXT,
      limit_usd    REAL,
      alert_at_pct REAL,
      created_at   TEXT
    );
  `)

  const today = new Date().toISOString()

  const insertRun = db.prepare(`
    INSERT INTO agent_runs (session_id, agent, model, started_at, status, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  // Asymmetric on purpose: 2 costed rows, 3 NULL-cost rows. A symmetric 2-vs-2 split
  // makes `IS NULL` and `IS NOT NULL` both count to 2, so a predicate polarity bug
  // (counting the wrong population) would pass silently either way. The 2-vs-3 split
  // means only the correct predicate returns 3.
  insertRun.run('sess-1', 'code-writer', 'sonnet', today, 'DONE', 0.012)
  insertRun.run('sess-1', 'code-reviewer', 'haiku', today, 'DONE', 0.002)
  insertRun.run('sess-2', 'debugger', 'sonnet', today, 'DONE', null)
  insertRun.run('sess-2', 'test-writer', 'haiku', today, 'DONE', null)
  insertRun.run('sess-2', 'planner', 'sonnet', today, 'DONE', null)

  return db
}

// ── Mock castDb module ─────────────────────────────────────────────────────────

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => testDb,
}))

const { budgetStatusRouter } = await import('../routes/budgetStatus.js')

const app = express()
app.use(express.json())
app.use('/api/budget', budgetStatusRouter)

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/budget/status', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  afterEach(() => {
    testDb?.close()
    testDb = null
  })

  it('returns runs_missing_cost as a number', async () => {
    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    expect(typeof res.body.runs_missing_cost).toBe('number')
  })

  it('runs_missing_cost equals the count of NULL-cost rows for today', async () => {
    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    // Seed has exactly 3 rows with cost_usd = NULL, started today (2 have a recorded cost).
    expect(res.body.runs_missing_cost).toBe(3)
  })

  it('runs_missing_cost is null when db is unavailable', async () => {
    testDb = null
    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    expect(res.body.runs_missing_cost).toBeNull()
    expect(res.body.runs_missing_cost).not.toBe(0)
  })

  it('runs_missing_cost is exactly 0 (not null) when no rows are missing a cost', async () => {
    testDb!.exec('DELETE FROM agent_runs')
    const today = new Date().toISOString()
    testDb!.prepare(`
      INSERT INTO agent_runs (session_id, agent, model, started_at, status, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-1', 'code-writer', 'sonnet', today, 'DONE', 0.012)

    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    expect(res.body.runs_missing_cost).toBe(0)
  })

  it('today_spend only sums non-null cost rows (lower bound), unaffected by missing rows', async () => {
    const res = await request(app).get('/api/budget/status')
    expect(res.status).toBe(200)
    // 0.012 + 0.002, NULL rows contribute 0 via SUM's NULL-skip behavior
    expect(res.body.today_spend).toBeCloseTo(0.014, 5)
  })
})
