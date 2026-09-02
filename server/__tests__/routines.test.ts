/**
 * S6 follow-up — last_run_output_path is a DB column written by the flagship's
 * routine runner under ~/.claude/routines-output/ (an absolute path). GET
 * /api/routines is public/unauthenticated — relativize it on the way out. Not
 * used for I/O anywhere in this route (only ever mapped into the JSON response).
 *
 * Note (flagged, not a blocker): src/views/RoutinesView.tsx also copies this
 * value verbatim to the clipboard via a "Copy" button, for the user to paste
 * elsewhere. A `~`-prefixed path still works when pasted into an unquoted shell
 * command (tilde expansion), but NOT if the user wraps it in quotes (bash/zsh
 * disable tilde expansion inside quotes) or pastes it into a tool that expects a
 * literal path. This test only covers the wire-format leak; the UX tradeoff is
 * for the team lead to weigh.
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

const { routinesRouter } = await import('../routes/routines.js')

const app = express()
app.use('/', routinesRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE routines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT,
      agent_to_dispatch TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_run_status TEXT,
      last_run_output_path TEXT,
      created_at TEXT NOT NULL
    )
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/routines — S6 path relativization', () => {
  it('returns a ~-prefixed last_run_output_path with no real home dir leak', async () => {
    const outputPath = path.join(os.homedir(), '.claude', 'routines-output', 'morning-briefing', '2026-08-01.md')
    testDb!.prepare(`
      INSERT INTO routines (id, name, trigger_type, agent_to_dispatch, enabled, last_run_at, last_run_status, last_run_output_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('r1', 'morning-briefing', 'cron', 'morning-briefing', 1, '2026-08-01T08:00:00Z', 'success', outputPath, '2026-01-01T00:00:00Z')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.routines).toHaveLength(1)
    expect(res.body.routines[0].last_run_output_path).toBe(
      path.join('~', '.claude', 'routines-output', 'morning-briefing', '2026-08-01.md')
    )
    expect(res.body.routines[0].last_run_output_path).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `last_run_output_path: relativizeHome(r.last_run_output_path ?? undefined) ?? null`
    // in routines.ts back to omitting the map (`const routines = rows`). With that
    // corruption, res.body.routines[0].last_run_output_path comes back as the raw
    // absolute outputPath and both assertions above fail.
  })

  it('passes through a null last_run_output_path unchanged', async () => {
    testDb!.prepare(`
      INSERT INTO routines (id, name, trigger_type, agent_to_dispatch, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('r2', 'never-run', 'manual', 'planner', 1, '2026-01-01T00:00:00Z')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.routines[0].last_run_output_path).toBeNull()
  })
})
