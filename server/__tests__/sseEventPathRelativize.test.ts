/**
 * S6 follow-up — sse.ts broadcasts a raw filesystem `path` in three LiveEvent
 * payloads: the historical-replay write on connect, and the watcher's 'add'/
 * 'change' handlers. None of these are HTTP JSON responses, but they're the
 * same client-facing leak (unauthenticated /api/events, absolute path handed
 * to every connected browser). All three now relativize at the broadcast/write
 * site while the `filePath`/`activeFile` variable stays absolute for the real
 * fs reads that precede it (readTail, readLastLine, readAgentMetaCached, etc.)
 * — same discipline as the HTTP routes in this unit.
 *
 * attachSSE() is skipped under VITEST, so — per the same approach used in
 * corsOrigin.test.ts — it's called here directly against a throwaway express()
 * app. chokidar and the cast.db poller are mocked out; the chokidar mock also
 * captures each watcher's registered event handlers so this test can invoke
 * the 'add'/'change' callbacks directly instead of needing a real filesystem
 * watch to fire.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import http from 'http'
import type { AddressInfo } from 'net'

type Handler = (arg: string) => void
// Keyed by the watched path (chokidar.watch()'s first argument) rather than
// call order — sse.ts makes two watch() calls (PROJECTS_DIR, then
// DASHBOARD_COMMANDS_DIR); selecting by index would silently grab the wrong
// watcher's handlers if those two calls were ever reordered, and the test
// would assert against the wrong instance instead of failing loudly.
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
function collectSseEvents(res: http.IncomingMessage): { events: unknown[]; buf: { raw: string } } {
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
  return { events, buf: state }
}

function wait(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Drop the `path` field before a whole-payload leak check.
 *
 * This is a documented EXCLUSION, not a claim that `path` is clean. Every
 * session JSONL lives under ~/.claude/projects/<encoded-project-dir>/…, and
 * that encoded segment embeds the operator's username in the path body (not
 * as a leading prefix) — e.g. `-Users-edkubiak-Projects-personal-...`.
 * relativizeHome() only strips a LEADING home-directory prefix; it does not
 * and cannot strip a segment embedded further into the path. So `path`, after
 * relativization, still carries the same username the `projectDir` field
 * used to leak directly. This is a KNOWN OPEN LEAK, not something handled
 * elsewhere in this codebase.
 *
 * It is deferred, not fixed, because it's one root cause shared by three
 * surfaces — this `path` field, compactionEvents.ts's `transcript_path`, and
 * sessions.ts/search.ts's `projectEncoded` (which is also a live routing key,
 * used by GET/DELETE/export routes and CommandPalette.tsx/SessionsView.tsx) —
 * plus routes/taskQueue.ts's buried `logPath`. Closing any one of them well
 * needs a single design decision (decode-and-substitute the project-dir
 * segment, or an opaque ID) applied consistently, not three separate patches.
 *
 * Removing this exclusion today makes this test fail against its own
 * `-Users-alice-Projects-personal-myapp` fixture (the `path` field would
 * still contain '-Users-alice-...' after relativizeHome()). Whoever picks up
 * the deferred fix should remove `withoutPath()` from the assertions below at
 * that point — this test is already waiting for them.
 */
function withoutPath(e: unknown): unknown {
  if (typeof e !== 'object' || e === null) return e
  const { path: _path, ...rest } = e as Record<string, unknown>
  return rest
}

describe('SSE watcher add/change events — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    watcherHandlersByPath = new Map()
    vi.resetModules()
  })

  it('relativizes `path` in both the add and the change broadcast events', async () => {
    const fs = await import('fs')
    // seedActiveFile() and the stale-reconciliation DB check are irrelevant to this
    // test and must stay inert — no real PROJECTS_DIR listing, no real cast.db open.
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
    const os = (await import('os')).default
    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const app = express()
    attachSSE(app)
    // Selected by the watched path (PROJECTS_DIR) itself, not by call order —
    // see the watcherHandlersByPath comment above.
    const mainWatcherHandlers = watcherHandlersByPath.get(PROJECTS_DIR)
    expect(mainWatcherHandlers?.add).toBeTypeOf('function')
    expect(mainWatcherHandlers?.change).toBeTypeOf('function')
    if (!mainWatcherHandlers) throw new Error('no watcher registered for PROJECTS_DIR')

    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port
    const fakeFilePath = path.join(PROJECTS_DIR, 'my-project', 'session-abc.jsonl')

    try {
      const { req, res, events } = await new Promise<{
        req: http.ClientRequest
        res: http.IncomingMessage
        events: unknown[]
      }>((resolve, reject) => {
        const request = http.get({ port, path: '/api/events' }, (response) => {
          const { events: collected } = collectSseEvents(response)
          resolve({ req: request, res: response, events: collected })
        })
        request.on('error', reject)
      })

      // Fire the watcher callbacks directly — no real chokidar/fs event needed.
      mainWatcherHandlers.add(fakeFilePath)
      await wait()
      mainWatcherHandlers.change(fakeFilePath)
      await wait()

      const withPath = events.filter(
        (e): e is { path?: string; type: string } =>
          typeof e === 'object' && e !== null && 'path' in (e as object)
      )
      expect(withPath.length).toBeGreaterThanOrEqual(2)
      for (const e of withPath) {
        expect(e.path).toBe(path.join('~', '.claude', 'projects', 'my-project', 'session-abc.jsonl'))
        expect(e.path).not.toContain(os.homedir())
      }

      // MUTATION TEST (manually verified, not left in the tree): revert BOTH
      // `path: relativizeHome(filePath)` occurrences in sse.ts's watcher.on('add', ...)
      // and watcher.on('change', ...) handlers back to `path: filePath`. With that
      // corruption, `e.path` for both events comes back as the raw absolute
      // fakeFilePath and both assertions above fail.

      res.destroy()
      req.destroy()
    } finally {
      server.close()
    }
  })

  it('relativizes `path` in the historical-replay event on connect', async () => {
    const fs = await import('fs')
    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
    const os = (await import('os')).default
    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const fakeFilePath = path.join(PROJECTS_DIR, 'my-project', 'session-abc.jsonl')
    const jsonlLine = JSON.stringify({
      timestamp: '2026-01-01T00:00:00Z',
      message: { role: 'user', content: 'hi' },
    })

    // Keep seedActiveFile()'s own directory sweep inert (no real PROJECTS_DIR
    // listing needed — activeJsonlPath is set below via the 'add' handler
    // instead), but let existsSync/statSync/readFileSync succeed for our one
    // fake file so readTail() can resolve it during the connect handler's
    // historical-replay block.
    vi.spyOn(fs.default, 'existsSync').mockImplementation((p) => p === fakeFilePath)
    vi.spyOn(fs.default, 'readdirSync').mockReturnValue([] as unknown as fs.Dirent[])
    vi.spyOn(fs.default, 'statSync').mockReturnValue({ size: jsonlLine.length, mtimeMs: Date.now() } as fs.Stats)
    vi.spyOn(fs.default, 'readFileSync').mockReturnValue(jsonlLine)

    const app = express()
    attachSSE(app)
    // Sets activeJsonlPath = fakeFilePath as a side effect (noteActiveFile) —
    // there is no exported setter, so this is the only way to seed it.
    // Selected by the watched path (PROJECTS_DIR), not by call order.
    const mainWatcherHandlers = watcherHandlersByPath.get(PROJECTS_DIR)
    if (!mainWatcherHandlers) throw new Error('no watcher registered for PROJECTS_DIR')
    mainWatcherHandlers.add(fakeFilePath)

    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port

    try {
      const { req, res, events } = await new Promise<{
        req: http.ClientRequest
        res: http.IncomingMessage
        events: unknown[]
      }>((resolve, reject) => {
        const request = http.get({ port, path: '/api/events' }, (response) => {
          const { events: collected } = collectSseEvents(response)
          resolve({ req: request, res: response, events: collected })
        })
        request.on('error', reject)
      })
      await wait()

      const historical = events.find(
        (e): e is { path?: string; historical?: boolean } =>
          typeof e === 'object' && e !== null && (e as { historical?: boolean }).historical === true
      )
      expect(historical).toBeDefined()
      expect(historical!.path).toBe(path.join('~', '.claude', 'projects', 'my-project', 'session-abc.jsonl'))
      expect(historical!.path).not.toContain(os.homedir())

      // MUTATION TEST (manually verified, not left in the tree): revert
      // `path: relativizeHome(activeFile)` in the historical-replay block back to
      // `path: activeFile`. With that corruption, `historical.path` comes back as
      // the raw absolute fakeFilePath and both assertions above fail.

      res.destroy()
      req.destroy()
    } finally {
      server.close()
    }
  })
})

describe('SSE broadcasts — projectDir dropped from the wire (username leak)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    watcherHandlersByPath = new Map()
    vi.resetModules()
  })

  it('never includes a projectDir key on any broadcast payload, and keeps the safe projectName', async () => {
    const fs = await import('fs')
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const app = express()
    attachSSE(app)
    const mainWatcherHandlers = watcherHandlersByPath.get(PROJECTS_DIR)
    if (!mainWatcherHandlers) throw new Error('no watcher registered for PROJECTS_DIR')

    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port
    // A realistic multi-segment encoded directory name (mimicking
    // ~/.claude/projects/-Users-<user>-Projects-... on disk) — deliberately NOT
    // a single word, so the encoded name and the decoded projectName differ.
    // decodeProjectPath()'s heuristic (mocked existsSync above always returns
    // false, so no real directory ever matches) falls through to splitting on
    // every hyphen, then takes only the LAST segment as projectName — here
    // that's 'myapp', while the raw encoded projectDir is the whole string
    // below, embedding the fake username 'alice'. A same-string fixture (e.g.
    // a hyphen-free name) would make the "payload never contains the encoded
    // name" check below meaningless, since the safe projectName would then be
    // textually identical to the leaky projectDir.
    const ENCODED_PROJECT_DIR = '-Users-alice-Projects-personal-myapp'
    const fakeFilePath = path.join(PROJECTS_DIR, ENCODED_PROJECT_DIR, 'session-abc.jsonl')

    try {
      const { req, res, events } = await new Promise<{
        req: http.ClientRequest
        res: http.IncomingMessage
        events: unknown[]
      }>((resolve, reject) => {
        const request = http.get({ port, path: '/api/events' }, (response) => {
          const { events: collected } = collectSseEvents(response)
          resolve({ req: request, res: response, events: collected })
        })
        request.on('error', reject)
      })

      mainWatcherHandlers.add(fakeFilePath)
      await wait()
      mainWatcherHandlers.change(fakeFilePath)
      await wait()

      // Inspect the FULL, unfiltered event list — not a subset filtered by some
      // other key (the path-relativization tests above filter by `'path' in e`,
      // which never looks at `projectDir` on those same objects; that's exactly
      // how this leak shipped unnoticed).
      expect(events.length).toBeGreaterThan(0)
      for (const e of events) {
        expect(e).not.toHaveProperty('projectDir')
        // Catches the leak regardless of which field it sneaks through (e.g. a
        // `?? projectDir` fallback re-emitting the encoded name via
        // `projectName` instead of a dedicated `projectDir` key) — a key-
        // absence check alone would miss that class of regression.
        expect(JSON.stringify(withoutPath(e))).not.toContain(ENCODED_PROJECT_DIR)
        expect(JSON.stringify(withoutPath(e))).not.toContain('alice')
      }

      const sessionUpdated = events.filter(
        (e): e is { type: string; projectName?: string } =>
          typeof e === 'object' && e !== null && (e as { type?: string }).type === 'session_updated'
      )
      expect(sessionUpdated.length).toBeGreaterThanOrEqual(2) // one from 'add', one from 'change'
      for (const e of sessionUpdated) {
        expect(e.projectName).toBe('myapp')
      }

      // MUTATION TEST (manually verified, not left in the tree): add `projectDir,`
      // back to the 'add' handler's session_updated broadcast in sse.ts (the
      // first `broadcast({ type: isSubagent ? 'agent_spawned' : ... })` call).
      // With that corruption, the `expect(e).not.toHaveProperty('projectDir')`
      // loop fails on that event, reporting the object DOES have a `projectDir`
      // property (its value being the raw encoded ENCODED_PROJECT_DIR string)
      // instead of the expected absence.

      res.destroy()
      req.destroy()
    } finally {
      server.close()
    }
  })

  it('never lets the encoded project name leak through the projectName fallback', async () => {
    // Forces decodeProjectPath() to return '' — the exact condition under which
    // `projectName: decodeProjectPath(projectDir).split('/').filter(Boolean).at(-1) ?? projectDir`
    // (the corrupted form) would re-emit the raw encoded name through
    // `projectName` instead of a `projectDir` key. vi.doMock (not vi.mock) so
    // this override applies only to this test's dynamic imports below, not the
    // other tests in this file that need the real decodeProjectPath.
    vi.doMock('../parsers/projectPath.js', () => ({ decodeProjectPath: () => '' }))

    const fs = await import('fs')
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const app = express()
    attachSSE(app)
    const mainWatcherHandlers = watcherHandlersByPath.get(PROJECTS_DIR)
    if (!mainWatcherHandlers) throw new Error('no watcher registered for PROJECTS_DIR')

    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port
    const ENCODED_PROJECT_DIR = '-Users-alice-Projects-personal-myapp'
    const fakeFilePath = path.join(PROJECTS_DIR, ENCODED_PROJECT_DIR, 'session-abc.jsonl')

    try {
      const { req, res, events } = await new Promise<{
        req: http.ClientRequest
        res: http.IncomingMessage
        events: unknown[]
      }>((resolve, reject) => {
        const request = http.get({ port, path: '/api/events' }, (response) => {
          const { events: collected } = collectSseEvents(response)
          resolve({ req: request, res: response, events: collected })
        })
        request.on('error', reject)
      })

      mainWatcherHandlers.add(fakeFilePath)
      await wait()

      expect(events.length).toBeGreaterThan(0)
      for (const e of events) {
        expect(e).not.toHaveProperty('projectDir')
        expect(JSON.stringify(withoutPath(e))).not.toContain(ENCODED_PROJECT_DIR)
        expect(JSON.stringify(withoutPath(e))).not.toContain('alice')
      }
      const sessionUpdated = events.find(
        (e): e is { type: string; projectName?: string } =>
          typeof e === 'object' && e !== null && (e as { type?: string }).type === 'session_updated'
      )
      expect(sessionUpdated).toBeDefined()
      // decodeProjectPath() stubbed to '' → split('/').filter(Boolean).at(-1)
      // is undefined → the fallback fires. '' is the honest degenerate value.
      expect(sessionUpdated!.projectName).toBe('')

      // MUTATION TEST (manually verified, not left in the tree): with
      // decodeProjectPath forced to return '' by the vi.doMock above, restore
      // the corrupted fallback `?? projectDir` in sse.ts's three
      // `projectName: ...` lines. With that corruption, `sessionUpdated.projectName`
      // comes back as the raw ENCODED_PROJECT_DIR string, and BOTH the
      // `not.toContain(ENCODED_PROJECT_DIR)` and `not.toContain('alice')`
      // assertions in the loop above fail, naming the leaked encoded string.

      res.destroy()
      req.destroy()
    } finally {
      server.close()
    }
  })
})
