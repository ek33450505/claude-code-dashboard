import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// Test database
let testDb: ReturnType<typeof Database> | null = null

function createTestDb(): ReturnType<typeof Database> {
  const db = new Database(':memory:')
  // Note: we deliberately do NOT create the injection_log table here
  // to test the table-exists guard behavior
  return db
}

// Mock getCastDb before importing routes
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { injectionLogRouter } = await import('../routes/injectionLog.js')

const app = express()
app.use(express.json())
app.use('/', injectionLogRouter)

beforeEach(() => {
  testDb = createTestDb()
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/injection-log', () => {
  it('returns 200 with correct shape { entries: [] } when table does not exist', async () => {
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('entries')
    expect(Array.isArray(res.body.entries)).toBe(true)
    expect(res.body.entries).toEqual([])
  })

  it('returns entries array when table exists and is empty', async () => {
    testDb!.exec(`
      CREATE TABLE injection_log (
        id INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        hook_type TEXT,
        content_preview TEXT
      )
    `)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
  })

  it('returns entries ordered by timestamp DESC when data exists', async () => {
    testDb!.exec(`
      CREATE TABLE injection_log (
        id INTEGER PRIMARY KEY,
        timestamp TEXT NOT NULL,
        hook_type TEXT,
        content_preview TEXT
      )
    `)

    const insert = testDb!.prepare(
      'INSERT INTO injection_log (timestamp, hook_type, content_preview) VALUES (?, ?, ?)'
    )
    insert.run('2026-05-01T10:00:00Z', 'PreToolUse', 'Agent: code-writer...')
    insert.run('2026-05-01T11:00:00Z', 'SessionStart', 'Journal entry: ...')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toHaveLength(2)
    expect(res.body.entries[0].timestamp).toBe('2026-05-01T11:00:00Z')
    expect(res.body.entries[1].timestamp).toBe('2026-05-01T10:00:00Z')
  })

  it('handles getCastDb returning null', async () => {
    testDb = null

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
  })
})
