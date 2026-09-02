import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import { RULES_DIR } from '../constants.js'
import { rulesRouter } from './rules.js'

// C9: PUT /:filename previously hand-rolled its own traversal guard
// (path.join + startsWith), diverging from GET /:filename (readRule(), which
// already goes through safeResolve). Both now share the same guard.

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/rules', rulesRouter)
  return app
}

describe('PUT /api/rules/:filename', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 when body is missing', async () => {
    const res = await request(makeApp()).put('/api/rules/some-rule.md').send({})
    expect(res.status).toBe(400)
  })

  it('returns 403 for an encoded traversal filename and never writes', async () => {
    // A raw unencoded '/' in the URL never reaches Express's single :filename
    // segment (the client/router normalizes it away before our handler runs,
    // so it would 404 regardless of the guard's correctness — not a real test
    // of the guard). %2f is the realistic attack shape: Express decodes it to
    // a literal '/' inside req.params.filename after routing already matched
    // a single segment, so '..%2f..%2fetc%2fpasswd' arrives as the string
    // '../../etc/passwd'.
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    const res = await request(makeApp())
      .put('/api/rules/..%2f..%2fetc%2fpasswd')
      .send({ body: 'pwned' })
    expect(res.status).toBe(403)
    expect(writeSpy).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): revert the guard
    // in rules.ts back to `path.join(RULES_DIR, req.params.filename)` +
    // `startsWith(RULES_DIR + path.sep)`. Both the old and new guard reject
    // this specific input identically (relative '../' traversal is caught by
    // both path.join normalization and safeResolve) — the guard that actually
    // diverges between old and new is the absolute-path case covered by the
    // next test.
  })

  it('returns 403 for a bare absolute-path filename (the safeResolve vs. path.join divergence)', async () => {
    // GET already used safeResolve (readRule); PUT used path.join, which does
    // NOT reset on an absolute second argument — path.join(RULES_DIR, '/etc/passwd')
    // stays confined under RULES_DIR (so the old guard let it through to a 404
    // "not found" rather than rejecting it as invalid). safeResolve's path.resolve
    // DOES reset on an absolute segment, so this now correctly 403s instead.
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    const res = await request(makeApp())
      .put('/api/rules/%2Fetc%2Fpasswd')
      .send({ body: 'pwned' })
    expect(res.status).toBe(403)
    expect(writeSpy).not.toHaveBeenCalled()

    // MUTATION TEST (manually verified, not left in the tree): revert the guard
    // back to the old path.join + startsWith check. With that reversion this
    // test fails: the old guard resolves '/etc/passwd' to
    // `${RULES_DIR}/etc/passwd` (still inside RULES_DIR), so it passes the
    // containment check and the route proceeds to fs.existsSync (mocked true
    // here) and calls writeFileSync — res.status comes back 200, not 403.
  })

  it('writes and returns 200 for a legitimate existing filename', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
    const res = await request(makeApp())
      .put('/api/rules/some-rule.md')
      .send({ body: 'new content' })
    expect(res.status).toBe(200)
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining(RULES_DIR),
      'new content',
      'utf-8',
    )
  })

  it('returns 404 for a legitimate filename that does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const res = await request(makeApp())
      .put('/api/rules/missing-rule.md')
      .send({ body: 'new content' })
    expect(res.status).toBe(404)
  })
})
