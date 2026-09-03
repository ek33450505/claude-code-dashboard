import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { ackEventsRouter } = await import('../routes/ackEvents.js')

const app = express()
app.use('/', ackEventsRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE ack_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variable TEXT NOT NULL,
      value TEXT,
      has_reason INTEGER NOT NULL DEFAULT 0,
      script TEXT,
      git_sha TEXT,
      session_id TEXT,
      repo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/cast/ack-events', () => {
  it('returns an empty envelope when the table has no rows', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ events: [] })
  })

  it('returns an empty envelope (not 404/500) when the DB is unavailable', async () => {
    testDb = null
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ events: [] })
  })

  it('flags a CAST_HATCH_RECORD_CAP row as a suppression sentinel, not a normal hatch', async () => {
    testDb!.prepare(`
      INSERT INTO ack_events (variable, value, has_reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run('CAST_HATCH_RECORD_CAP', '3', 0, '2026-08-01 00:00:00')
    testDb!.prepare(`
      INSERT INTO ack_events (variable, value, has_reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run('CAST_COMMIT_AGENT', '1', 1, '2026-08-01 00:00:01')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    const byVariable = Object.fromEntries(
      (res.body.events as Array<{ variable: string; is_cap_sentinel: boolean }>).map((e) => [e.variable, e.is_cap_sentinel])
    )
    expect(byVariable.CAST_HATCH_RECORD_CAP).toBe(true)
    expect(byVariable.CAST_COMMIT_AGENT).toBe(false)

    // MUTATION CHECK (manually verified, not left in tree): remove the mapRow from
    // ackEvents.ts (`const events = rows`) — is_cap_sentinel is then undefined for
    // every row and both assertions above fail.
  })
})
