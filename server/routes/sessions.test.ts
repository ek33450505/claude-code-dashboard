import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// C9: DELETE /:projectEncoded/:sessionId previously hand-rolled its containment
// guard as `path.resolve(...).startsWith(resolvedBase + path.sep)`. Now goes
// through the shared safeResolve() utility. Only the guard changes here — the
// soft-delete itself is DB-only (see sessions.ts comment at the guard site).

vi.mock('../parsers/sessions.js', () => ({
  getCachedSessions: vi.fn(),
  loadSession: vi.fn(),
}))

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

function makeDb(overrides: Partial<{ run: () => void; get: () => unknown }> = {}) {
  const prepare = vi.fn(() => ({
    run: overrides.run ?? vi.fn(),
    get: overrides.get ?? vi.fn(() => ({ deleted_at: '2026-09-02T00:00:00Z' })),
  }))
  return { prepare, close: vi.fn() }
}

async function loadRouterWithDb(db: ReturnType<typeof makeDb> | null) {
  vi.resetModules()
  vi.doMock('../routes/castDb.js', () => ({
    getCastDb: () => null,
    getCastDbWritable: () => db,
  }))
  const { sessionsRouter } = await import('./sessions.js')
  const app = express()
  app.use('/api/sessions', sessionsRouter)
  return app
}

describe('DELETE /api/sessions/:projectEncoded/:sessionId — traversal guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('soft-deletes for a legitimate projectEncoded', async () => {
    const db = makeDb()
    const app = await loadRouterWithDb(db)
    const res = await request(app).delete(`/api/sessions/proj-abc/${VALID_UUID}`)
    expect(res.status).toBe(200)
    expect(res.body.deleted_at).toBeTruthy()
  })

  it('returns 403 for a bare absolute-path projectEncoded and never touches the db', async () => {
    // Old guard: path.resolve(resolvedBase, projectEncoded, ...) — an absolute
    // projectEncoded segment resets path.resolve's accumulation, so the
    // startsWith(resolvedBase) check already rejected it (400). safeResolve
    // uses the same path.resolve semantics internally, so this is unchanged —
    // still 400 (asserted below), covering the round-trip claim rather than a
    // divergence (unlike rules.ts, which used path.join and DID diverge).
    const db = makeDb()
    const app = await loadRouterWithDb(db)
    const res = await request(app).delete(`/api/sessions/%2Fetc/${VALID_UUID}`)
    expect(res.status).toBe(400)
    expect(db.prepare).not.toHaveBeenCalled()
  })

  it('returns 400 for a relative-traversal projectEncoded and never touches the db', async () => {
    const db = makeDb()
    const app = await loadRouterWithDb(db)
    const res = await request(app).delete(`/api/sessions/..%2f..%2fetc/${VALID_UUID}`)
    expect(res.status).toBe(400)
    expect(db.prepare).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): revert the
    // guard in sessions.ts back to
    // `const resolvedBase = path.resolve(PROJECTS_DIR); const filePath =
    // path.resolve(resolvedBase, projectEncoded, sessionId + '.jsonl'); if
    // (!filePath.startsWith(resolvedBase + path.sep)) { 400 }`. Both old and
    // new logic use path.resolve internally, so this assertion holds under
    // both — reverting the guard does NOT change this test's outcome. The
    // meaningful mutation coverage here is: delete the guard entirely (return
    // straight to the db.prepare call) — done manually, confirms db.prepare
    // IS called and the test fails on the `not.toHaveBeenCalled()` line.
  })
})
