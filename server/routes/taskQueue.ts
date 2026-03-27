import { Router } from 'express'
import Database from 'better-sqlite3'
import { getCastDb } from './castDb.js'
import { CAST_DB } from '../constants.js'
import fs from 'fs'

export const taskQueueRouter = Router()

taskQueueRouter.get('/', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({
        tasks: [],
        counts: { pending: 0, claimed: 0, done: 0, failed: 0 },
      })
    }

    const tasks = db.prepare(`
      SELECT
        id, agent, priority, status, created_at, retry_count,
        scheduled_for, result_summary, task_data, error_message
      FROM task_queue
      ORDER BY priority ASC, created_at DESC
    `).all() as Array<{
      id: string; agent: string; priority: number; status: string;
      created_at: string; retry_count: number; scheduled_for: string | null;
      result_summary: string | null; task_data: string | null; error_message: string | null
    }>

    const countsRows = db.prepare(`
      SELECT status, COUNT(*) AS cnt FROM task_queue GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>

    const counts: Record<string, number> = { pending: 0, claimed: 0, done: 0, failed: 0 }
    for (const r of countsRows) {
      if (r.status in counts) counts[r.status] = r.cnt
    }

    res.json({ tasks, counts })
  } catch (err) {
    console.error('Task queue error:', err)
    res.status(500).json({ error: 'Failed to fetch task queue' })
  }
})

taskQueueRouter.delete('/:id', (req, res) => {
  const { id } = req.params
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid task id' })
  }
  if (!fs.existsSync(CAST_DB)) {
    return res.status(404).json({ error: 'cast.db not found' })
  }
  let db: ReturnType<typeof Database> | null = null
  try {
    db = new Database(CAST_DB, { fileMustExist: true })
    const result = db.prepare('DELETE FROM task_queue WHERE id = ?').run(id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' })
    }
    res.json({ success: true, deleted: id })
  } catch (err) {
    console.error('Delete task error:', err)
    res.status(500).json({ error: 'Failed to delete task' })
  } finally {
    if (db) db.close()
  }
})
