import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// C2b: the shared "list a cast.db table" route factory replacing eight hand-rolled
// ~25-line routes. See server/routes/evalRuns.ts / injectionLog.ts for the pilots.

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { makeTableRouter } = await import('./makeTableRouter.js')

function createWidgetsDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE widgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  return db
}

function insertWidgets(db: ReturnType<typeof Database>, count: number) {
  const stmt = db.prepare('INSERT INTO widgets (name, created_at) VALUES (?, ?)')
  for (let i = 0; i < count; i++) {
    // ascending created_at so ORDER BY DESC is verifiable
    stmt.run(`widget-${i}`, `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`)
  }
}

function mountApp(router: ReturnType<typeof makeTableRouter>) {
  const app = express()
  app.use(express.json())
  app.use('/', router)
  return app
}

beforeEach(() => {
  testDb = createWidgetsDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('makeTableRouter', () => {
  it('happy path: returns rows under the configured key, respecting orderBy', async () => {
    insertWidgets(testDb!, 3)
    const app = mountApp(
      makeTableRouter({ table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets' })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.widgets).toHaveLength(3)
    // DESC order -> most recently inserted (widget-2) first
    expect(res.body.widgets[0].name).toBe('widget-2')
    expect(res.body.widgets[2].name).toBe('widget-0')
  })

  it('{default, max} limit: ?limit=2 returns 2 rows', async () => {
    insertWidgets(testDb!, 10)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        limit: { default: 5, max: 100 },
      })
    )
    const res = await request(app).get('/?limit=2')
    expect(res.status).toBe(200)
    expect(res.body.widgets).toHaveLength(2)
  })

  it('{default, max} limit: ?limit=-1 is clamped to the default, not unlimited', async () => {
    // seed MORE rows than the default so clamped vs unlimited are distinguishable
    insertWidgets(testDb!, 10)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        limit: { default: 5, max: 100 },
      })
    )
    const res = await request(app).get('/?limit=-1')
    expect(res.status).toBe(200)
    expect(res.body.widgets).toHaveLength(5)
  })

  it('{fixed} limit: the query param is ignored', async () => {
    insertWidgets(testDb!, 10)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        limit: { fixed: 3 },
      })
    )
    const res = await request(app).get('/?limit=9999')
    expect(res.status).toBe(200)
    expect(res.body.widgets).toHaveLength(3)
  })

  it('missing table -> 200 with the empty envelope (not 404/500)', async () => {
    testDb = new Database(':memory:') // no widgets table
    const app = mountApp(
      makeTableRouter({ table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets' })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ widgets: [] })
  })

  it('missing DB (getCastDb returns null) -> 200 with the empty envelope', async () => {
    testDb = null
    const app = mountApp(
      makeTableRouter({ table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets' })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ widgets: [] })
  })

  it('mapRow is applied to every row', async () => {
    insertWidgets(testDb!, 2)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        mapRow: (row) => ({ ...row, name: row.name.toUpperCase() }),
      })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.widgets.every((w: any) => w.name === w.name.toUpperCase())).toBe(true)
  })

  it('includeTotal reports COUNT(*) over the whole table, not the page length', async () => {
    insertWidgets(testDb!, 10)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        limit: { default: 3, max: 100 },
        includeTotal: true,
      })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.widgets).toHaveLength(3)
    expect(res.body.total).toBe(10)
  })

  it('a custom respond shapes both the populated AND the empty response', async () => {
    insertWidgets(testDb!, 2)
    const app = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        respond: (rows, total) => ({ items: rows, count: rows.length, grandTotal: total }),
      })
    )
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: expect.any(Array), count: 2, grandTotal: 0 })

    // empty path — table missing — must go through the same custom respond
    testDb = new Database(':memory:')
    const emptyApp = mountApp(
      makeTableRouter({
        table: 'widgets', columns: 'id, name', orderBy: 'created_at DESC', key: 'widgets', tag: 'widgets',
        respond: (rows, total) => ({ items: rows, count: rows.length, grandTotal: total }),
      })
    )
    const emptyRes = await request(emptyApp).get('/')
    expect(emptyRes.status).toBe(200)
    expect(emptyRes.body).toEqual({ items: [], count: 0, grandTotal: 0 })
  })

  it('an invalid table name throws at construction', () => {
    expect(() =>
      makeTableRouter({ table: 'widgets; DROP TABLE widgets', columns: 'id', orderBy: 'id', key: 'widgets', tag: 'widgets' })
    ).toThrow()
    expect(() =>
      makeTableRouter({ table: '1widgets', columns: 'id', orderBy: 'id', key: 'widgets', tag: 'widgets' })
    ).toThrow()
  })
})
