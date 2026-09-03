/**
 * CAST v10 Unit 6, finding #2 — the SSE stale-reconciliation block used to
 * open a brand-new `better-sqlite3` handle on every /api/events connection
 * instead of reusing the shared readonly singleton (getCastDb() from
 * server/routes/castDb.ts). EventSource auto-reconnects aggressively on any
 * network blip, so that was real per-reconnect open/close overhead, and the
 * raw connection never got the singleton's busy_timeout pragma — a reconnect
 * landing mid-write (cast.db is written concurrently by the CAST flagship's
 * out-of-process hooks) hit SQLITE_BUSY immediately and was silently
 * swallowed by the surrounding best-effort try/catch.
 *
 * Harness follows sseEventPathRelativize.test.ts: attachSSE() is skipped
 * under VITEST, so it's called directly against a throwaway express() app.
 * chokidar and the cast.db poller are mocked out the same way. castDb.js is
 * additionally mocked here so getCastDb() can be spied on directly — the
 * cleanest way to prove (a) the shared singleton is what's called (not a raw
 * `new Database(...)`) and (b) the returned handle is never closed by this
 * code path (closing the shared singleton would break every other reader).
 * A second /api/events connection in the same test additionally proves this
 * behaviorally: the shared handle survives being reused across connections.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'
import Database from 'better-sqlite3'

type Handler = (arg: string) => void
let watcherHandlersByPath = new Map<string, Record<string, Handler>>()

vi.mock('chokidar', () => ({
  default: {
    watch: (watchPath: string) => {
      const handlers: Record<string, Handler> = {}
      watcherHandlersByPath.set(watchPath, handlers)
      return {
        on: (event: string, cb: Handler) => { handlers[event] = cb },
        close: () => {},
      }
    },
  },
}))
vi.mock('../watchers/castDbWatcher.js', () => ({
  startCastDbWatcher: () => {},
  stopCastDbWatcher: () => {},
}))

/** Collect SSE `data: {...}` frames off a raw http response as JSON objects. */
function collectSseEvents(res: http.IncomingMessage): { events: unknown[] } {
  const state = { raw: '' }
  const events: unknown[] = []
  res.on('data', (chunk: Buffer) => {
    state.raw += chunk.toString('utf-8')
    const frames = state.raw.split('\n\n')
    state.raw = frames.pop() ?? ''
    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data: '))
      if (!line) continue
      try { events.push(JSON.parse(line.slice('data: '.length))) } catch { /* skip */ }
    }
  })
  return { events }
}

function wait(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function connect(port: number): Promise<{ req: http.ClientRequest; res: http.IncomingMessage; events: unknown[] }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ port, path: '/api/events' }, (response) => {
      const { events } = collectSseEvents(response)
      resolve({ req: request, res: response, events })
    })
    request.on('error', reject)
  })
}

type StaleReconcileEvent = { type: string; doneSessionIds?: string[] }
function findStaleReconcile(events: unknown[]): StaleReconcileEvent | undefined {
  return events.find(
    (e): e is StaleReconcileEvent => typeof e === 'object' && e !== null && (e as { type?: string }).type === 'stale_reconcile'
  )
}

describe('SSE stale reconciliation — shared getCastDb() singleton (fix #2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    watcherHandlersByPath = new Map()
    vi.resetModules()
  })

  it('uses getCastDb() (not a raw connection), emits correct doneSessionIds, and never closes the shared handle', async () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE agent_runs (session_id TEXT, status TEXT, ended_at TEXT)')
    const recentTimestamp = new Date().toISOString()
    db.prepare('INSERT INTO agent_runs (session_id, status, ended_at) VALUES (?, ?, ?)').run('sess-1', 'DONE', recentTimestamp)

    const closeSpy = vi.spyOn(db, 'close')
    const getCastDbMock = vi.fn(() => db)
    vi.doMock('../routes/castDb.js', () => ({ getCastDb: getCastDbMock }))

    const fs = await import('fs')
    // Keep the historical-replay block and seedActiveFile() inert — irrelevant
    // to this test, and must not touch a real PROJECTS_DIR.
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const app = express()
    attachSSE(app)
    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port

    try {
      const first = await connect(port)
      await wait()
      const firstEvent = findStaleReconcile(first.events)
      expect(firstEvent).toBeDefined()
      expect(firstEvent?.doneSessionIds).toEqual(['sess-1'])
      first.res.destroy()
      first.req.destroy()

      expect(getCastDbMock).toHaveBeenCalled()
      // Load-bearing assertion: the shared singleton must never be closed by
      // the SSE route — doing so would break every other reader of getCastDb().
      expect(closeSpy).not.toHaveBeenCalled()

      // A second connection reusing the (still-open) shared handle proves the
      // fix behaviorally: if this code path had closed the connection after
      // the first request, this second stale-reconcile query would throw
      // against a closed database and doneSessionIds would never arrive.
      const second = await connect(port)
      await wait()
      const secondEvent = findStaleReconcile(second.events)
      expect(secondEvent).toBeDefined()
      expect(secondEvent?.doneSessionIds).toEqual(['sess-1'])
      second.res.destroy()
      second.req.destroy()

      expect(closeSpy).not.toHaveBeenCalled()
      expect(getCastDbMock.mock.calls.length).toBeGreaterThanOrEqual(2)

      // MUTATION TEST (manually verified 2026-09-03, not left in the tree):
      // reverted the stale-reconciliation block in sse.ts back to
      // `new Database(CAST_DB, { readonly: true, fileMustExist: true })` +
      // `db.close()` in its finally block. Result: getCastDbMock was never
      // called (spy call count 0), failing `expect(getCastDbMock).toHaveBeenCalled()`
      // — this is exactly the regression this test exists to catch. Reverted
      // sse.ts back to its committed state after confirming the red result.
    } finally {
      server.close()
      db.close()
    }
  })
})
