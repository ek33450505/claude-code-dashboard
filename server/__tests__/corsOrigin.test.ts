/**
 * S8 regression — the SSE endpoint (server/watchers/sse.ts) used to hardcode
 * 'http://localhost:5173' as Access-Control-Allow-Origin instead of honoring
 * CORS_ORIGIN like every other route (server/index.ts). Both places now read
 * the single CORS_ORIGIN constant (server/constants.ts), and both set
 * `Vary: Origin` so a cache in front of this server can't serve one origin's
 * CORS header to a different origin.
 *
 * CORS_ORIGIN is read once at module-load time (server/constants.ts), so each
 * origin value below gets a fresh module graph via vi.resetModules() + a
 * re-import — mirrors the pattern in agentRunsU3.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import http from 'http'
import type { AddressInfo } from 'net'

describe('server/index.ts CORS middleware — honors CORS_ORIGIN + sets Vary', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN
    vi.resetModules()
  })

  it('reflects the default origin and sets Vary: Origin when CORS_ORIGIN is unset', async () => {
    delete process.env.CORS_ORIGIN
    vi.resetModules()
    const { app } = await import('../index.js')

    const res = await request(app).get('/api/agents/roster')

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(res.headers['vary']).toBe('Origin')
  })

  it('reflects a custom CORS_ORIGIN', async () => {
    process.env.CORS_ORIGIN = 'https://example.test'
    vi.resetModules()
    const { app } = await import('../index.js')

    const res = await request(app).get('/api/agents/roster')

    expect(res.headers['access-control-allow-origin']).toBe('https://example.test')
    expect(res.headers['vary']).toBe('Origin')

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `res.header('Access-Control-Allow-Origin', CORS_ORIGIN)` in index.ts back to
    // the old `res.header('Access-Control-Allow-Origin', allowedOrigin)` computed
    // from a re-inlined `process.env.CORS_ORIGIN ?? 'http://localhost:5173'` BUT
    // with the env read deleted (simulating the header silently going stale) —
    // concretely: hardcode the header to the literal default string. With that
    // corruption this test's `toBe('https://example.test')` assertion fails,
    // observing 'http://localhost:5173' instead.
  })
})

// attachSSE() is skipped under VITEST (see server/index.ts), so it's called here
// directly against a throwaway express() app rather than the real exported `app`.
// chokidar and the cast.db poller are mocked out so this test starts no real file
// watchers and touches no real filesystem/DB — only the '/api/events' request
// handler (where the CORS header lives) is exercised.
vi.mock('chokidar', () => ({
  default: { watch: () => ({ on: () => {}, close: () => {} }) },
}))
vi.mock('../watchers/castDbWatcher.js', () => ({
  startCastDbWatcher: () => {},
  stopCastDbWatcher: () => {},
}))

describe('SSE /api/events — honors CORS_ORIGIN + sets Vary', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGIN
    vi.resetModules()
  })

  it('reflects a custom CORS_ORIGIN on the SSE response head', async () => {
    process.env.CORS_ORIGIN = 'https://example.test'
    vi.resetModules()
    const fs = await import('fs')
    // Keep seedActiveFile() and the stale-reconciliation block inert — neither
    // PROJECTS_DIR nor CAST_DB should be treated as present for this test.
    vi.spyOn(fs.default, 'existsSync').mockReturnValue(false)

    const express = (await import('express')).default
    const { attachSSE } = await import('../watchers/sse.js')

    const app = express()
    attachSSE(app)
    const server = app.listen(0)
    const port = (server.address() as AddressInfo).port

    try {
      const headers = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
        const req = http.get({ port, path: '/api/events' }, (res) => {
          // The SSE connection stays open — resolve on headers, then tear the
          // socket down immediately instead of waiting on the body/heartbeat
          // (which would otherwise hang this test for 15s).
          resolve(res.headers)
          res.destroy()
          req.destroy()
        })
        req.on('error', reject)
      })

      expect(headers['access-control-allow-origin']).toBe('https://example.test')
      expect(headers['vary']).toBe('Origin')

      // MUTATION TEST (manually verified, not left in the tree): revert
      // `'Access-Control-Allow-Origin': CORS_ORIGIN` in sse.ts back to the
      // hardcoded `'http://localhost:5173'`. With that corruption, `headers['access-
      // control-allow-origin']` comes back as 'http://localhost:5173' instead of
      // 'https://example.test' and the first assertion above fails.
    } finally {
      server.close()
    }
  })
})
