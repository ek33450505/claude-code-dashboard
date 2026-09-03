/**
 * v10 Unit 6 (performance) finding #1 — GET /api/sessions durationMs/status
 * backfill was a sequential per-session N+1 query against cast.db
 * (`stmt.get(session.id)` inside a for-loop). Batched to a single
 * `WHERE id IN (...)` query. This test proves the batched fallback still
 * backfills durationMs/status correctly and — critically — that results
 * don't cross-contaminate between sessions when more than one row is
 * batched in a single query.
 *
 * Fixture DB pattern follows server/__tests__/agentRunsU3.test.ts
 * (in-memory better-sqlite3 + vi.doMock('../routes/castDb.js', ...)).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

function makeFixtureDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE sessions (
      id           TEXT PRIMARY KEY,
      project      TEXT,
      project_root TEXT,
      started_at   TEXT,
      ended_at     TEXT,
      status       TEXT,
      deleted_at   TEXT
    );
  `)
  return db
}

describe('GET /api/sessions — N+1 batched durationMs/status backfill', () => {
  let db: ReturnType<typeof Database>

  beforeEach(() => {
    vi.resetModules()
    db = makeFixtureDb()
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
  })

  it('backfills durationMs/status for multiple null-duration sessions without cross-contamination', async () => {
    db.prepare(`
      INSERT INTO sessions (id, started_at, ended_at, status)
      VALUES ('sess-a', '2026-08-01T00:00:00.000Z', '2026-08-01T00:05:00.000Z', 'DONE')
    `).run()
    db.prepare(`
      INSERT INTO sessions (id, started_at, ended_at, status)
      VALUES ('sess-b', '2026-08-01T01:00:00.000Z', '2026-08-01T01:02:00.000Z', 'BLOCKED')
    `).run()

    vi.doMock('../routes/castDb.js', () => ({ getCastDb: () => db, getCastDbWritable: () => db }))
    vi.doMock('../parsers/sessions.js', () => ({
      getCachedSessions: () => [
        {
          id: 'sess-a',
          project: 'proj-a',
          projectPath: '/tmp/proj-a',
          projectEncoded: 'proj-a',
          startedAt: '2026-08-01T00:00:00.000Z',
          durationMs: null,
          messageCount: 1,
          toolCallCount: 0,
          agentCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        {
          id: 'sess-b',
          project: 'proj-b',
          projectPath: '/tmp/proj-b',
          projectEncoded: 'proj-b',
          startedAt: '2026-08-01T01:00:00.000Z',
          durationMs: null,
          messageCount: 1,
          toolCallCount: 0,
          agentCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      ],
      loadSession: vi.fn(),
    }))

    const { sessionsRouter } = await import('../routes/sessions.js')
    const app = express()
    app.use('/api/sessions', sessionsRouter)

    const res = await request(app).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)

    const a = res.body.find((s: { id: string }) => s.id === 'sess-a')
    const b = res.body.find((s: { id: string }) => s.id === 'sess-b')

    // sess-a: 5 minutes = 300000ms, status DONE
    expect(a.durationMs).toBe(5 * 60 * 1000)
    expect(a.status).toBe('DONE')

    // sess-b: 2 minutes = 120000ms, status BLOCKED — must NOT pick up sess-a's values
    expect(b.durationMs).toBe(2 * 60 * 1000)
    expect(b.status).toBe('BLOCKED')

    // MUTATION TEST (manually verified, not left in the tree): swapping the batched
    // `rowById = new Map(rows.map(r => [r.session_id, r]))` keying for a broken lookup
    // (e.g. always returning rows[0] regardless of session.id) makes sess-b's
    // durationMs/status assertions above fail — they'd read sess-a's values instead
    // (300000/'DONE' on both rows) — confirming the test actually detects
    // cross-contamination between batched rows, not just presence of a value.
  })

  it('leaves durationMs null when no matching cast.db row exists for a session', async () => {
    // No sessions inserted into the fixture DB — batched IN(...) query returns zero rows.
    vi.doMock('../routes/castDb.js', () => ({ getCastDb: () => db, getCastDbWritable: () => db }))
    vi.doMock('../parsers/sessions.js', () => ({
      getCachedSessions: () => [{
        id: 'sess-orphan',
        project: 'proj-orphan',
        projectPath: '/tmp/proj-orphan',
        projectEncoded: 'proj-orphan',
        startedAt: '2026-08-01T00:00:00.000Z',
        durationMs: null,
        messageCount: 1,
        toolCallCount: 0,
        agentCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      }],
      loadSession: vi.fn(),
    }))

    const { sessionsRouter } = await import('../routes/sessions.js')
    const app = express()
    app.use('/api/sessions', sessionsRouter)

    const res = await request(app).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].durationMs).toBeNull()
  })
})
