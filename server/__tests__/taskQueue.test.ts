/**
 * Regression test for cast.db task_queue column name mismatch.
 *
 * Bug: taskQueue.ts SELECT query referenced nonexistent columns `task_data`
 * and `error_message`. The actual schema has `task` (not `task_data`) and
 * no `error_message` column. This caused SQLite to throw on every GET request,
 * returning a 500 instead of the task list.
 *
 * Fix location: server/routes/taskQueue.ts — column names corrected to `task`.
 */

import { describe, it, expect, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

// ---------------------------------------------------------------------------
// Build a minimal in-memory cast.db with the real schema and seed data.
// Created at module scope so the vi.mock factory can capture it immediately
// (vi.mock is hoisted before beforeAll, so module-level init is required).
// ---------------------------------------------------------------------------

const _testDb = new Database(':memory:')

_testDb.exec(`
  CREATE TABLE task_queue (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at            TEXT,
    project               TEXT,
    project_root          TEXT,
    agent                 TEXT,
    task                  TEXT NOT NULL,
    priority              INTEGER DEFAULT 5,
    status                TEXT DEFAULT 'pending',
    claimed_at            TEXT,
    claimed_by_session    TEXT,
    completed_at          TEXT,
    result_summary        TEXT,
    retry_count           INTEGER DEFAULT 0,
    max_retries           INTEGER DEFAULT 3,
    scheduled_for         TEXT
  );
`)

_testDb.prepare(`
  INSERT INTO task_queue (created_at, agent, task, priority, status, retry_count)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('2026-03-26T10:00:00Z', 'code-reviewer', 'Review the login component', 3, 'pending', 0)

// ---------------------------------------------------------------------------
// Mock getCastDb before the router is imported so the mock is in scope.
// ---------------------------------------------------------------------------

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => _testDb,
}))

// Router is imported AFTER the mock is registered.
const { taskQueueRouter } = await import('../routes/taskQueue.js')

const app = express()
app.use(express.json())
app.use('/', taskQueueRouter)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cast/task-queue — column name regression', () => {
  it('returns 200 with tasks array and counts (not a 500 from bad column names)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('tasks')
    expect(res.body).toHaveProperty('counts')
  })

  it('returns the seeded task with correct shape (task field present, not task_data)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)

    const tasks: Record<string, unknown>[] = res.body.tasks
    expect(tasks).toHaveLength(1)

    const task = tasks[0]
    // `task` must be present (the real column name)
    expect(task).toHaveProperty('task', 'Review the login component')
    // `task_data` must NOT be present (the bad column name from the original bug)
    expect(task).not.toHaveProperty('task_data')
    // `error_message` must NOT be present (also nonexistent in schema)
    expect(task).not.toHaveProperty('error_message')
  })

  it('returns correct pending count', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.body.counts.pending).toBe(1)
    expect(res.body.counts.done).toBe(0)
    expect(res.body.counts.failed).toBe(0)
  })
})
