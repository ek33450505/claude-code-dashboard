import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { agentRunsDailyRouter, mcpCallsDailyRouter } = await import('../routes/rollups.js')

const agentRunsApp = express()
agentRunsApp.use('/', agentRunsDailyRouter)
const mcpApp = express()
mcpApp.use('/', mcpCallsDailyRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE agent_runs_daily (
      day TEXT NOT NULL, agent TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '', runs INTEGER NOT NULL DEFAULT 0, with_response INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_input_tokens INTEGER NOT NULL DEFAULT 0, cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0, tool_uses INTEGER NOT NULL DEFAULT 0,
      rolled_up_at TEXT NOT NULL, PRIMARY KEY (day, agent, model, status)
    );
    CREATE TABLE mcp_calls_daily (
      day TEXT NOT NULL, mcp_server TEXT NOT NULL DEFAULT '', mcp_tool TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '', is_cloud_bound INTEGER NOT NULL DEFAULT 0,
      calls INTEGER NOT NULL DEFAULT 0, result_bytes INTEGER NOT NULL DEFAULT 0,
      rolled_up_at TEXT NOT NULL, PRIMARY KEY (day, mcp_server, mcp_tool, outcome, is_cloud_bound)
    );
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/cast/agent-runs-daily', () => {
  it('returns an empty envelope when the table has no rows', async () => {
    const res = await request(agentRunsApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ days: [] })
  })

  it('computes avg_cost_per_run as SUM(cost_usd)/SUM(runs), never AVG(cost_usd)', async () => {
    // Two pre-aggregated buckets on the same day, different agents, deliberately
    // skewed so AVG(cost_usd) and SUM/SUM diverge: AVG would be (2 + 20) / 2 = 11;
    // SUM/SUM is (2 + 20) / (2 + 1) = 22 / 3 = 7.333...
    // A recent-but-not-today date, computed from real "now" (the route's WHERE
    // clause runs against SQLite's own clock, so a fixed calendar date would fall
    // outside the `days` window whenever the suite runs far enough in the future).
    const day = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    testDb!.prepare(`
      INSERT INTO agent_runs_daily (day, agent, model, status, runs, cost_usd, rolled_up_at)
      VALUES (?, 'backend-writer', 'sonnet', 'DONE', 2, 2.0, ?)
    `).run(day, `${day} 03:30:00`)
    testDb!.prepare(`
      INSERT INTO agent_runs_daily (day, agent, model, status, runs, cost_usd, rolled_up_at)
      VALUES (?, 'code-reviewer', 'sonnet', 'DONE', 1, 20.0, ?)
    `).run(day, `${day} 03:30:00`)

    const res = await request(agentRunsApp).get('/?days=90')

    expect(res.status).toBe(200)
    const row = res.body.days.find((d: { day: string }) => d.day === day)
    expect(row).toBeDefined()
    expect(row.runs).toBe(3)
    expect(row.cost_usd).toBeCloseTo(22.0, 6)
    expect(row.avg_cost_per_run).toBeCloseTo(22.0 / 3, 6)
    expect(row.avg_cost_per_run).not.toBeCloseTo(11.0, 6)

    // MUTATION CHECK (manually verified, not left in tree): change
    // `r.cost_usd / r.runs` in rollups.ts to `(2.0 + 20.0) / 2` (an AVG-style
    // per-bucket average) — avg_cost_per_run reads 11 and the last assertion fails.
  })

  it('flags the row for today as is_partial (nightly rollup runs ~03:30, so today is always incomplete)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    testDb!.prepare(`
      INSERT INTO agent_runs_daily (day, agent, model, status, runs, cost_usd, rolled_up_at)
      VALUES (?, 'backend-writer', 'sonnet', 'DONE', 1, 1.0, ?)
    `).run(today, `${today} 03:30:00`)
    testDb!.prepare(`
      INSERT INTO agent_runs_daily (day, agent, model, status, runs, cost_usd, rolled_up_at)
      VALUES (?, 'backend-writer', 'sonnet', 'DONE', 1, 1.0, ?)
    `).run(fiveDaysAgo, `${fiveDaysAgo} 03:30:00`)

    const res = await request(agentRunsApp).get('/?days=90')

    const todayRow = res.body.days.find((d: { day: string }) => d.day === today)
    const oldRow = res.body.days.find((d: { day: string }) => d.day === fiveDaysAgo)
    expect(todayRow.is_partial).toBe(true)
    expect(oldRow?.is_partial).toBe(false)

    // MUTATION CHECK (manually verified, not left in tree): hardcode `is_partial: false`
    // in rollups.ts — the first assertion above fails.
  })
})

describe('GET /api/cast/mcp-calls-daily', () => {
  it('returns an empty envelope when the table has no rows', async () => {
    const res = await request(mcpApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ days: [] })
  })

  it('sums calls across matching buckets for a day', async () => {
    const day = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    testDb!.prepare(`
      INSERT INTO mcp_calls_daily (day, mcp_server, mcp_tool, outcome, is_cloud_bound, calls, result_bytes, rolled_up_at)
      VALUES (?, 'neon', 'query', 'ok', 1, 5, 1000, ?)
    `).run(day, `${day} 03:30:00`)
    testDb!.prepare(`
      INSERT INTO mcp_calls_daily (day, mcp_server, mcp_tool, outcome, is_cloud_bound, calls, result_bytes, rolled_up_at)
      VALUES (?, 'neon', 'mutate', 'ok', 1, 3, 500, ?)
    `).run(day, `${day} 03:30:00`)

    const res = await request(mcpApp).get('/?days=90')

    expect(res.status).toBe(200)
    const row = res.body.days.find((d: { day: string; mcp_server: string }) => d.day === day && d.mcp_server === 'neon')
    expect(row.calls).toBe(8)
    expect(row.result_bytes).toBe(1500)
  })
})
