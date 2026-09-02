/**
 * S6 follow-up — worktree_path/repo_root are DB columns written by the flagship's
 * git-worktree checker (cast-subagent-worktree-check.sh), holding absolute paths
 * under $HOME. GET /api/worktree-anomalies is public/unauthenticated — relativize
 * both fields on the way out. Neither is used for I/O anywhere in this route (the
 * row is only ever mapped straight into the JSON response).
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

const { worktreeAnomaliesRouter } = await import('../routes/worktreeAnomalies.js')

const app = express()
app.use('/', worktreeAnomaliesRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE worktree_anomalies (
      id INTEGER PRIMARY KEY,
      agent_id TEXT,
      worktree_path TEXT,
      detected_at TEXT NOT NULL,
      repo_root TEXT,
      state TEXT,
      reason TEXT
    )
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/worktree-anomalies — S6 path relativization', () => {
  it('returns ~-prefixed worktree_path and repo_root with no real home dir leak', async () => {
    const worktreePath = path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team-worktrees', 'feature-x')
    const repoRoot = path.join(os.homedir(), 'Projects', 'personal', 'claude-agent-team')
    testDb!.prepare(
      'INSERT INTO worktree_anomalies (agent_id, worktree_path, detected_at, repo_root, state, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('backend-writer', worktreePath, '2026-08-01T00:00:00Z', repoRoot, 'stale', 'no commits in 3d')

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.anomalies).toHaveLength(1)
    expect(res.body.anomalies[0].worktree_path).toBe(
      path.join('~', 'Projects', 'personal', 'claude-agent-team-worktrees', 'feature-x')
    )
    expect(res.body.anomalies[0].repo_root).toBe(path.join('~', 'Projects', 'personal', 'claude-agent-team'))
    expect(res.body.anomalies[0].worktree_path).not.toContain(os.homedir())
    expect(res.body.anomalies[0].repo_root).not.toContain(os.homedir())

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // `.map(r => ({ ...r, worktree_path: relativizeHome(...), repo_root: relativizeHome(...) }))`
    // in worktreeAnomalies.ts back to `const anomalies = rows`. With that
    // corruption, both fields come back as the raw absolute paths (containing
    // the real home directory) and all four assertions above fail.
  })

  it('passes through null worktree_path/repo_root unchanged', async () => {
    testDb!.prepare(
      'INSERT INTO worktree_anomalies (agent_id, worktree_path, detected_at, repo_root, state, reason) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('backend-writer', null, '2026-08-01T00:00:00Z', null, 'unknown', null)

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.body.anomalies[0].worktree_path).toBeNull()
    expect(res.body.anomalies[0].repo_root).toBeNull()
  })
})
