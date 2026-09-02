/**
 * S6 — sse.ts broadcasts a client-facing `path` field in three LiveEvent
 * payloads over the unauthenticated /api/events stream: the historical-replay
 * write on connect (sse.ts:302), the watcher's 'add' handler (sse.ts:381),
 * and the watcher's 'change' handler (sse.ts:494). Each of those three sites
 * now redacts with `redactPath()` (server/utils/projectKey.ts) — relativizeHome()
 * composed with maskProjectKey() — which closes BOTH leak shapes a raw
 * PROJECTS_DIR-derived path carries: the leading real home-directory prefix
 * (`/Users/alice/...`) AND the username re-embedded mid-string inside the
 * hyphen-encoded project-directory segment (`-Users-alice-Projects-...`). A
 * bare relativizeHome() only ever strips the former, leaving the latter
 * exposed — that half-fixed state used to be this file's known open gap.
 *
 * Every assertion below inspects the FULL broadcast payload — nothing is
 * excluded — and pins the exact fully-redacted string, using a fixture whose
 * encoded project-directory segment embeds a fake username ('alice') so a
 * regression to bare relativizeHome() (which would leave that segment
 * untouched) fails loudly instead of passing by accident. `os.homedir()` is
 * mocked to `/Users/alice` before every dynamic import in this file, so
 * PROJECTS_DIR (computed at module load in server/constants.ts) and
 * maskProjectKey()'s encoded-home comparison both key off the same
 * deterministic value regardless of who runs the suite.
 *
 * Mutation-tested 2026-09-02: each of the three `redactPath(...)` call sites
 * in sse.ts was reverted to `relativizeHome(...)` one at a time, run, and
 * reverted back — see the MUTATION TEST comment beside each pinned assertion
 * below for the specific failure that produced.
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

// Mocked onto os.homedir() before every dynamic import below, so PROJECTS_DIR
// (computed once at module load in server/constants.ts) and maskProjectKey()'s
// encoded-home comparison (computed at call time in server/utils/projectKey.ts)
// are both deterministic regardless of who/where this suite runs.
const MOCK_HOME = '/Users/alice'
// A realistic multi-segment encoded directory name (mimicking
// ~/.claude/projects/-Users-<user>-Projects-... on disk): MOCK_HOME re-encoded
// (`/` -> `-`) mid-string, followed by further real segments. This is the
// exact shape maskProjectKey() must catch that a leading-only relativizeHome()
// cannot — the fixture embeds the username further into the string, not just
// as a leading prefix.
const ENCODED_PROJECT_DIR = '-Users-alice-Projects-personal-myapp'

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

describe('SSE watcher add/change events — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    watcherHandlersByPath = new Map()
    vi.resetModules()
  })

  it('redacts `path` in both the add and the change broadcast events', async () => {
    // Mock os.homedir() BEFORE the dynamic imports below — constants.ts
    // computes PROJECTS_DIR from it at module load time.
    const os = (await import('os')).default
    vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOME)

    const fs = await import('fs')
    // seedActiveFile() and the stale-reconciliation DB check are irrelevant to this
    // test and must stay inert — no real PROJECTS_DIR listing, no real cast.db open.
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
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
    const fakeFilePath = path.join(PROJECTS_DIR, ENCODED_PROJECT_DIR, 'session-abc.jsonl')
    // redactPath() = relativizeHome (strips the leading /Users/alice prefix,
    // yielding '~') composed with maskProjectKey (masks the '-Users-alice-'
    // still embedded mid-string in the encoded project-dir segment, yielding
    // '~-Projects-personal-myapp').
    const expectedPath = path.join('~', '.claude', 'projects', '~-Projects-personal-myapp', 'session-abc.jsonl')

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
        expect(e.path).toBe(expectedPath)
        expect(e.path).not.toContain('alice')
        expect(e.path).not.toContain(ENCODED_PROJECT_DIR)
      }

      // MUTATION TEST (manually verified 2026-09-02, not left in the tree):
      // reverted `path: redactPath(filePath)` to `path: relativizeHome(filePath)`
      // in sse.ts's watcher.on('add', ...) handler (sse.ts:381), ran this test
      // alone — FAILED: `e.path` came back as
      // '~/.claude/projects/-Users-alice-Projects-personal-myapp/session-abc.jsonl'
      // (the embedded encoded segment and 'alice' still present), failing both
      // the `expectedPath` equality and the `not.toContain('alice')` assertion
      // for the 'add' event. Reverted the corruption, repeated for the
      // 'change' handler (sse.ts:494) with the identical failure on the
      // 'change' event. Reverted sse.ts back to its committed state after
      // each.

      res.destroy()
      req.destroy()
    } finally {
      server.close()
    }
  })

  it('redacts `path` in the historical-replay event on connect', async () => {
    const os = (await import('os')).default
    vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOME)

    const fs = await import('fs')
    const { PROJECTS_DIR } = await import('../constants.js')
    const path = (await import('path')).default
    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const fakeFilePath = path.join(PROJECTS_DIR, ENCODED_PROJECT_DIR, 'session-abc.jsonl')
    const expectedPath = path.join('~', '.claude', 'projects', '~-Projects-personal-myapp', 'session-abc.jsonl')
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
      expect(historical!.path).toBe(expectedPath)
      expect(historical!.path).not.toContain('alice')
      expect(historical!.path).not.toContain(ENCODED_PROJECT_DIR)

      // MUTATION TEST (manually verified 2026-09-02, not left in the tree):
      // reverted `path: redactPath(activeFile)` to `path: relativizeHome(activeFile)`
      // in the historical-replay block (sse.ts:302), ran this test alone —
      // FAILED: `historical.path` came back as
      // '~/.claude/projects/-Users-alice-Projects-personal-myapp/session-abc.jsonl'
      // — failing both the `expectedPath` equality and the
      // `not.toContain('alice')` assertion above. Reverted sse.ts back to its
      // committed state.

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
    const os = (await import('os')).default
    vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOME)

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
    // decodeProjectPath()'s heuristic (mocked existsSync above always returns
    // false, so no real directory ever matches) falls through to splitting on
    // every hyphen, then takes only the LAST segment as projectName — here
    // that's 'myapp', while the raw encoded projectDir is the whole string
    // below, embedding the fake username 'alice'.
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

      // Inspect the FULL, unfiltered event list — `path` included. redactPath()
      // is wired at every broadcast site in sse.ts, so nothing needs to be
      // excluded here to make these assertions pass; excluding it would hide
      // exactly the class of regression this test exists to catch.
      expect(events.length).toBeGreaterThan(0)
      for (const e of events) {
        expect(e).not.toHaveProperty('projectDir')
        // Catches the leak regardless of which field it sneaks through (e.g. a
        // `?? projectDir` fallback re-emitting the encoded name via
        // `projectName` instead of a dedicated `projectDir` key, or an
        // unredacted `path`) — a key-absence check alone would miss that
        // class of regression.
        expect(JSON.stringify(e)).not.toContain(ENCODED_PROJECT_DIR)
        expect(JSON.stringify(e)).not.toContain('alice')
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

    const os = (await import('os')).default
    vi.spyOn(os, 'homedir').mockReturnValue(MOCK_HOME)

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
        expect(JSON.stringify(e)).not.toContain(ENCODED_PROJECT_DIR)
        expect(JSON.stringify(e)).not.toContain('alice')
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
