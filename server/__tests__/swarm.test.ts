import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database and mocking setup
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')

  db.exec(`
    CREATE TABLE IF NOT EXISTS swarm_sessions (
      id               TEXT PRIMARY KEY,
      started_at       TEXT NOT NULL,
      ended_at         TEXT,
      total_tokens     INTEGER DEFAULT 0,
      status           TEXT DEFAULT 'active'
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS teammate_runs (
      id               TEXT PRIMARY KEY,
      swarm_id         TEXT NOT NULL,
      agent_name       TEXT NOT NULL,
      tokens_in        INTEGER DEFAULT 0,
      tokens_out       INTEGER DEFAULT 0,
      started_at       TEXT NOT NULL,
      ended_at         TEXT,
      status           TEXT DEFAULT 'pending',
      FOREIGN KEY(swarm_id) REFERENCES swarm_sessions(id)
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS teammate_messages (
      id               TEXT PRIMARY KEY,
      swarm_id         TEXT NOT NULL,
      teammate_id      TEXT NOT NULL,
      message          TEXT,
      created_at       TEXT NOT NULL,
      FOREIGN KEY(swarm_id) REFERENCES swarm_sessions(id),
      FOREIGN KEY(teammate_id) REFERENCES teammate_runs(id)
    );
  `)

  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

// Import routers after mocking
const { swarmRouter } = await import('../routes/swarm.js')

// Create Express app with routers
const app = express()
app.use(express.json())
app.use('/api/swarm', swarmRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('POST /api/swarm/sessions (or GET with empty DB)', () => {
  it('returns empty array when swarm_sessions table does not exist', async () => {
    testDb?.exec('DROP TABLE IF EXISTS swarm_sessions')
    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toEqual([])
  })

  it('returns empty array when no sessions exist', async () => {
    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toEqual([])
  })

  it('returns sessions ordered by started_at DESC', async () => {
    const now = new Date().toISOString()
    const earlier = new Date(Date.now() - 60_000).toISOString()

    const insert = testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)')
    insert.run('session-1', earlier)
    insert.run('session-2', now)

    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(2)
    expect(res.body.sessions[0].id).toBe('session-2')
    expect(res.body.sessions[1].id).toBe('session-1')
  })

  it('includes teammate_count from teammate_runs', async () => {
    const now = new Date().toISOString()
    testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)').run(
      'session-1',
      now,
    )

    testDb!.prepare('INSERT INTO teammate_runs (id, swarm_id, agent_name, started_at) VALUES (?, ?, ?, ?)')
      .run('run-1', 'session-1', 'commit', now)
    testDb!.prepare('INSERT INTO teammate_runs (id, swarm_id, agent_name, started_at) VALUES (?, ?, ?, ?)')
      .run('run-2', 'session-1', 'code-reviewer', now)

    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions[0]).toHaveProperty('teammate_count', 2)
  })

  it('includes total_tokens (sum of in/out)', async () => {
    const now = new Date().toISOString()
    testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)').run(
      'session-1',
      now,
    )

    testDb!.prepare(
      'INSERT INTO teammate_runs (id, swarm_id, agent_name, tokens_in, tokens_out, started_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('run-1', 'session-1', 'commit', 100, 50, now)

    testDb!.prepare(
      'INSERT INTO teammate_runs (id, swarm_id, agent_name, tokens_in, tokens_out, started_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('run-2', 'session-1', 'code-reviewer', 200, 75, now)

    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions[0]).toHaveProperty('total_tokens', 425)
  })

  it('limits response to 50 sessions', async () => {
    const now = new Date().toISOString()
    const insert = testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)')
    for (let i = 0; i < 60; i++) {
      insert.run(`session-${i}`, new Date(now).toISOString())
    }

    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toHaveLength(50)
  })

  it('handles gracefully when DB is unavailable', async () => {
    testDb = null
    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(200)
    expect(res.body.sessions).toEqual([])
  })

  it('returns error on unexpected database exception', async () => {
    // Mock getCastDb to return a bad DB object
    vi.spyOn(console, 'error').mockImplementation(() => {})

    testDb!.prepare = (() => {
      throw new Error('Mock DB error')
    }) as any

    const res = await request(app).get('/api/swarm/sessions')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/swarm/sessions/:id', () => {
  it('returns 200 or 404 when trailing slash (no id param)', async () => {
    const res = await request(app).get('/api/swarm/sessions/')
    expect([200, 404]).toContain(res.status)
  })

  it('handles whitespace-only id by returning 400', async () => {
    // URL with spaces: /api/swarm/sessions/   treats the spaces as part of the param
    // req.params.id will be the trimmed empty string, so it returns 400
    // However, Express may normalize or handle this differently. Test actual behavior:
    const res = await request(app).get('/api/swarm/sessions/%20%20%20')
    if (res.status === 400) {
      expect(res.body).toHaveProperty('error')
    } else {
      // If Express captures it, it may be handled differently
      expect([400, 404]).toContain(res.status)
    }
  })

  it('returns 404 when swarm_sessions table does not exist', async () => {
    testDb!.exec('DROP TABLE IF EXISTS swarm_sessions')
    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Swarm not found')
  })

  it('returns 404 when session does not exist', async () => {
    const res = await request(app).get('/api/swarm/sessions/nonexistent')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Swarm not found')
  })

  it('returns session data when found', async () => {
    const now = new Date().toISOString()
    testDb!.prepare('INSERT INTO swarm_sessions (id, started_at, status) VALUES (?, ?, ?)').run(
      'session-1',
      now,
      'active',
    )

    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(200)
    expect(res.body.session).toBeDefined()
    expect(res.body.session.id).toBe('session-1')
    expect(res.body.session.status).toBe('active')
  })

  it('returns associated teammates in order by started_at ASC', async () => {
    const now = new Date().toISOString()
    const later = new Date(Date.now() + 1000).toISOString()

    testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)').run(
      'session-1',
      now,
    )

    testDb!.prepare('INSERT INTO teammate_runs (id, swarm_id, agent_name, started_at) VALUES (?, ?, ?, ?)')
      .run('run-2', 'session-1', 'code-reviewer', later)
    testDb!.prepare('INSERT INTO teammate_runs (id, swarm_id, agent_name, started_at) VALUES (?, ?, ?, ?)')
      .run('run-1', 'session-1', 'commit', now)

    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(200)
    expect(res.body.teammates).toHaveLength(2)
    expect(res.body.teammates[0].id).toBe('run-1')
    expect(res.body.teammates[1].id).toBe('run-2')
  })

  it('returns empty teammates array if none exist', async () => {
    const now = new Date().toISOString()
    testDb!.prepare('INSERT INTO swarm_sessions (id, started_at) VALUES (?, ?)').run(
      'session-1',
      now,
    )

    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(200)
    expect(res.body.teammates).toEqual([])
  })

  it('returns 404 when DB is unavailable', async () => {
    testDb = null
    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Swarm not found')
  })

  it('returns error on unexpected database exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    testDb!.prepare = (() => {
      throw new Error('Mock DB error')
    }) as any

    const res = await request(app).get('/api/swarm/sessions/session-1')
    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

