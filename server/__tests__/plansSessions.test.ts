/**
 * S6 follow-up — plan_sessions.plan_file is a DB column written from
 * orchestrate-dispatch.py's `--plan` CLI argument, plausibly an absolute path
 * to a plan file. GET /api/plans/sessions is public/unauthenticated — relativize
 * it on the way out. Not used for I/O anywhere in this route (only ever mapped
 * into the JSON response).
 *
 * Frontend consumer check: src/views/PlansView.tsx is the only consumer
 * (grepped `plan_file` across src/, excluding the unrelated `task_name AS
 * plan_file` alias qualityGates.ts uses for /api/dispatch-decisions, which is
 * NOT a real path) — it renders `s.plan_file.split('/').pop()` (basename only)
 * and uses the raw value only as a `title` tooltip. Both are unaffected by
 * relativization (basename extraction ignores the prefix; the tooltip is
 * display-only).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import os from 'os'
import path from 'path'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../parsers/memory.js', () => ({ loadPlans: () => [] }))
vi.mock('../routes/castDb.js', () => ({ getCastDb: () => testDb }))

const { plansRouter } = await import('../routes/plans.js')

const app = express()
app.use('/api/plans', plansRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE plan_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      plan_file TEXT NOT NULL,
      started_at TEXT NOT NULL
    )
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/plans/sessions — S6 path relativization', () => {
  it('returns a ~-prefixed plan_file with no real home dir leak', async () => {
    const planFile = path.join(os.homedir(), '.claude', 'plans', 'v10-security-plan.md')
    testDb!.prepare(
      'INSERT INTO plan_sessions (session_id, plan_file, started_at) VALUES (?, ?, ?)'
    ).run('sess-1', planFile, '2026-08-01T00:00:00Z')

    const res = await request(app).get('/api/plans/sessions')

    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(1)
    expect(res.body.sessions[0].plan_file).toBe(path.join('~', '.claude', 'plans', 'v10-security-plan.md'))
    expect(res.body.sessions[0].plan_file).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `plan_file: relativizeHome(r.plan_file ?? undefined) ?? null` in plans.ts
    // back to omitting the map (`const sessions = rows`). With that corruption,
    // res.body.sessions[0].plan_file comes back as the raw absolute planFile and
    // both assertions above fail.
  })
})
