import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import type { LiveEvent } from '../../src/types/index.js'

// C6: the live-update engine (poll + rowid-watermark diff + broadcast). In-memory DB
// via a mocked getCastDb + fake timers — no real cast.db / $HOME, no real interval.
const h = vi.hoisted(() => ({
  db: null as unknown as import('better-sqlite3').Database,
  invalidateCastDbIfChanged: () => {},
}))
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => h.db,
  // D15 wiring: pollOnce() must call invalidateCastDbIfChanged() every tick, before
  // getCastDb() — spied on below to assert the call actually happens.
  invalidateCastDbIfChanged: () => h.invalidateCastDbIfChanged(),
}))

const { startCastDbWatcher, stopCastDbWatcher } = await import('../watchers/castDbWatcher.js')

beforeAll(() => {
  h.db = new Database(':memory:')
  h.db.exec(`
    CREATE TABLE agent_runs (id INTEGER PRIMARY KEY, agent TEXT, status TEXT, session_id TEXT);
    CREATE TABLE sessions (id TEXT PRIMARY KEY);
    CREATE TABLE routing_events (id INTEGER PRIMARY KEY);
  `)
})
afterAll(() => { h.db?.close() })

describe('castDbWatcher', () => {
  it('seeds watermarks, broadcasts only rows inserted after start, and stops cleanly', () => {
    vi.useFakeTimers()
    const insertRun = h.db.prepare('INSERT INTO agent_runs (agent, status, session_id) VALUES (?, ?, ?)')

    // Pre-existing row — must NOT be re-emitted (initHighWatermarks seeds past it).
    insertRun.run('code-writer', 'running', 's1')

    const events: LiveEvent[] = []
    startCastDbWatcher(e => events.push(e), 1000)

    const agentRunEvents = () => events.filter(e => e.type === 'db_change_agent_run')

    vi.advanceTimersByTime(1000)
    expect(agentRunEvents()).toHaveLength(0)

    // A new row is broadcast on the next poll.
    insertRun.run('debugger', 'DONE', 's2')
    vi.advanceTimersByTime(1000)
    expect(agentRunEvents()).toHaveLength(1)
    expect(agentRunEvents()[0]).toMatchObject({
      dbChangeTable: 'agent_runs',
      dbChangeAgentName: 'debugger',
      dbChangeStatus: 'DONE',
      dbChangeSessionId: 's2',
    })

    // After stop, later rows are not broadcast.
    stopCastDbWatcher()
    insertRun.run('commit', 'DONE', 's3')
    vi.advanceTimersByTime(5000)
    expect(agentRunEvents()).toHaveLength(1)

    vi.useRealTimers()
  })

  it('calls invalidateCastDbIfChanged() on every poll tick (D15 wiring)', () => {
    vi.useFakeTimers()
    const invalidateSpy = vi.fn()
    h.invalidateCastDbIfChanged = invalidateSpy

    startCastDbWatcher(() => {}, 1000)
    expect(invalidateSpy).toHaveBeenCalledTimes(0) // not called until the first tick

    vi.advanceTimersByTime(1000)
    expect(invalidateSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(invalidateSpy).toHaveBeenCalledTimes(4)

    stopCastDbWatcher()
    vi.advanceTimersByTime(5000)
    expect(invalidateSpy).toHaveBeenCalledTimes(4) // stopped — no further ticks

    h.invalidateCastDbIfChanged = () => {}
    vi.useRealTimers()
  })
})
