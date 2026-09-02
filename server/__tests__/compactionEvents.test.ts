/**
 * S6 follow-up — transcript_path is a DB column populated verbatim from Claude
 * Code's own PreCompact hook payload (cast-precompact-log.py writes
 * `data.get('transcript_path', '')`), an absolute path under
 * ~/.claude/projects/. GET /api/cast/compaction-events is public/unauthenticated
 * — relativize it on the way out. Not used for I/O anywhere in this route
 * (only ever mapped into the JSON response), and unread by any current frontend
 * consumer (grepped src/views/AnalyticsView.tsx — fetched via
 * useCompactionEvents but never rendered).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'
import os from 'os'
import path from 'path'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { compactionEventsRouter } = await import('../routes/compactionEvents.js')

const app = express()
app.use('/', compactionEventsRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE compaction_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp TEXT NOT NULL,
      trigger TEXT,
      compaction_tier TEXT,
      transcript_path TEXT
    )
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/cast/compaction-events — S6 path relativization', () => {
  it('returns a ~-prefixed transcript_path with no real home dir leak', async () => {
    const transcriptPath = path.join(os.homedir(), '.claude', 'projects', 'my-project', 'session-abc.jsonl')
    testDb!.prepare(`
      INSERT INTO compaction_events (id, session_id, timestamp, trigger, compaction_tier, transcript_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('e1', 'sess-1', '2026-08-01T00:00:00Z', 'auto', 'PreCompact', transcriptPath)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(1)
    expect(res.body.events[0].transcript_path).toBe(
      path.join('~', '.claude', 'projects', 'my-project', 'session-abc.jsonl')
    )
    expect(res.body.events[0].transcript_path).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `transcript_path: relativizeHome(r.transcript_path ?? undefined) ?? null` in
    // compactionEvents.ts back to omitting the map (`const events = rows`). With
    // that corruption, res.body.events[0].transcript_path comes back as the raw
    // absolute transcriptPath and both assertions above fail.
  })

  it('passes through a null transcript_path unchanged', async () => {
    testDb!.prepare(`
      INSERT INTO compaction_events (id, session_id, timestamp, trigger, compaction_tier, transcript_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('e2', 'sess-2', '2026-08-01T00:00:00Z', 'manual', null, null)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.events[0].transcript_path).toBeNull()
  })
})
