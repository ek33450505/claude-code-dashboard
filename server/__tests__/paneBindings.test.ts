import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import { controlGate } from '../middleware/controlGate.js'

let testDb: ReturnType<typeof Database> | null = null

function makeWritableProxy(db: Database.Database): Database.Database {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'close') return () => {}
      const val = (target as Record<string | symbol, unknown>)[prop as string]
      return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(target) : val
    },
  }) as Database.Database
}

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => (testDb ? makeWritableProxy(testDb) : null),
}))

const { paneBindingsRouter } = await import('../routes/paneBindings.js')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/pane-bindings', controlGate)
  app.use('/api/pane-bindings', paneBindingsRouter)
  return app
}

const TOKEN = 'unit-test-token'
const ORIG_ENV: Record<string, string | undefined> = {}

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE pane_bindings (
      pane_id TEXT PRIMARY KEY, session_id TEXT,
      started_at INTEGER, ended_at INTEGER, project_path TEXT
    )
  `)
  ORIG_ENV.CAST_DASHBOARD_CONTROL = process.env.CAST_DASHBOARD_CONTROL
  ORIG_ENV.DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN
  delete process.env.CAST_DASHBOARD_CONTROL
  delete process.env.DASHBOARD_TOKEN
})

afterEach(() => {
  testDb?.close()
  testDb = null
  if (ORIG_ENV.CAST_DASHBOARD_CONTROL !== undefined) process.env.CAST_DASHBOARD_CONTROL = ORIG_ENV.CAST_DASHBOARD_CONTROL
  else delete process.env.CAST_DASHBOARD_CONTROL
  if (ORIG_ENV.DASHBOARD_TOKEN !== undefined) process.env.DASHBOARD_TOKEN = ORIG_ENV.DASHBOARD_TOKEN
  else delete process.env.DASHBOARD_TOKEN
})

describe('POST /api/pane-bindings/notify — gate', () => {
  it('returns 404 when CAST_DASHBOARD_CONTROL is unset (never touches the DB)', async () => {
    const res = await request(makeApp())
      .post('/api/pane-bindings/notify')
      .send({ pane_id: 'pane-1' })
    expect(res.status).toBe(404)
    expect(testDb!.prepare('SELECT * FROM pane_bindings').all()).toHaveLength(0)
  })

  it('returns 403 with a wrong token when control is enabled', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN
    const res = await request(makeApp())
      .post('/api/pane-bindings/notify')
      .set('X-Dashboard-Token', 'wrong')
      .send({ pane_id: 'pane-1' })
    expect(res.status).toBe(403)
  })

  it('returns 400 for a missing pane_id', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN
    const res = await request(makeApp())
      .post('/api/pane-bindings/notify')
      .set('X-Dashboard-Token', TOKEN)
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/pane-bindings/notify — upsert correctness', () => {
  beforeEach(() => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = TOKEN
  })

  it('inserts a new binding with started_at set', async () => {
    const res = await request(makeApp())
      .post('/api/pane-bindings/notify')
      .set('X-Dashboard-Token', TOKEN)
      .send({ pane_id: 'pane-1', session_id: 'sess-1', project_path: '/repo' })

    expect(res.status).toBe(200)
    const row = testDb!.prepare('SELECT * FROM pane_bindings WHERE pane_id = ?').get('pane-1') as {
      started_at: number; session_id: string
    }
    expect(row.session_id).toBe('sess-1')
    expect(typeof row.started_at).toBe('number')
    expect(row.started_at).toBeGreaterThan(0)
  })

  it('preserves started_at across a second notify for the same pane_id', async () => {
    const app = makeApp()
    await request(app)
      .post('/api/pane-bindings/notify')
      .set('X-Dashboard-Token', TOKEN)
      .send({ pane_id: 'pane-2', session_id: 'sess-a' })

    const first = testDb!.prepare('SELECT started_at FROM pane_bindings WHERE pane_id = ?').get('pane-2') as { started_at: number }

    // Force a distinguishable started_at on the pre-existing row so a second
    // notify overwriting it (instead of preserving it) is unambiguous.
    testDb!.prepare('UPDATE pane_bindings SET started_at = ? WHERE pane_id = ?').run(111, 'pane-2')

    await request(app)
      .post('/api/pane-bindings/notify')
      .set('X-Dashboard-Token', TOKEN)
      .send({ pane_id: 'pane-2', session_id: 'sess-b', project_path: '/repo2' })

    const second = testDb!.prepare('SELECT * FROM pane_bindings WHERE pane_id = ?').get('pane-2') as {
      started_at: number; session_id: string; project_path: string
    }
    expect(second.started_at).toBe(111)
    expect(second.session_id).toBe('sess-b')
    expect(second.project_path).toBe('/repo2')
    expect(first.started_at).not.toBe(0)

    // MUTATION CHECK (manually verified, not left in tree): add `started_at = excluded.started_at`
    // to the ON CONFLICT SET list in paneBindings.ts — second.started_at then reads a fresh
    // epoch-seconds value instead of 111 and the assertion above fails.
  })
})

describe('GET /api/pane-bindings', () => {
  it('lists bindings ordered by started_at DESC, ungated', async () => {
    testDb!.prepare('INSERT INTO pane_bindings (pane_id, session_id, started_at) VALUES (?, ?, ?)').run('p1', 's1', 100)
    testDb!.prepare('INSERT INTO pane_bindings (pane_id, session_id, started_at) VALUES (?, ?, ?)').run('p2', 's2', 200)

    const res = await request(makeApp()).get('/api/pane-bindings')

    expect(res.status).toBe(200)
    expect(res.body.bindings.map((b: { pane_id: string }) => b.pane_id)).toEqual(['p2', 'p1'])
  })
})
