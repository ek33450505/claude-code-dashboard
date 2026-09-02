/**
 * S7 regression test — rate limiters MUST be mounted before controlGate in
 * server/index.ts, not after.
 *
 * `controlGate` 403s an invalid `X-Dashboard-Token` before a limiter mounted AFTER it
 * ever runs, so a limiter mounted after the gate never sees (and never throttles)
 * invalid-token guesses — an attacker can brute-force DASHBOARD_TOKEN with unlimited
 * free 403s. Mounting the limiter BEFORE the gate means every request (valid token or
 * not) consumes a slot, and once the window's budget is spent, guesses start coming
 * back 429 instead of another free 403.
 *
 * Uses the REAL exported `app` from server/index.ts (not an isolated harness) so this
 * test is sensitive to the actual mount order in that file — a hand-rolled harness
 * re-wiring its own copy of controlGate + rateLimit would not catch a regression in the
 * real file. Import is side-effect-free under vitest (index.ts guards
 * listen()/watchers/mkdir behind !process.env.VITEST — see controlGateWiring.test.ts).
 *
 * Deliberately a SINGLE test in the first describe block below: express-rate-limit's
 * default in-memory store keys by IP only (no custom keyGenerator), and every supertest
 * request in a test process looks like the same client. Splitting THAT scenario across
 * multiple `it()`s would let one test's exhausted window bleed into the next and
 * produce a false pass/fail for the wrong reason — see the dispatch note this test was
 * written from.
 *
 * The FIRST describe block below (`/api/control` + `destructiveLimiter`) IS isolated
 * from the other two: it uses a genuinely different `rateLimit()` instance and a
 * different prefix, and express-rate-limit's per-IP store is scoped to the instance
 * it belongs to (not shared globally by IP across different `rateLimit()` calls) — so
 * nothing in this file can bleed into or out of block 1's budget.
 *
 * The SECOND and THIRD describe blocks (cheapReadLimiter / SAFE_METHODS skip, covering
 * /api/agents and /api/hook-events respectively) do NOT have that same isolation —
 * an earlier revision of this comment incorrectly claimed they did. Both mount the
 * SAME `cheapReadLimiter` instance, so their non-GET probe loops draw from ONE shared
 * per-IP budget (see the shared-budget note above `const controlLimiter` in
 * server/index.ts) — if block 2's non-GET loop runs first and spends the budget,
 * block 3's non-GET loop can start already exhausted. This was considered, not missed
 * (security__u3bi-final review), and does not currently produce a false pass: each
 * block's GET assertion is unaffected regardless of bleed (`skip` short-circuits GET
 * before the shared counter is ever consulted), and each block's non-GET assertion
 * (`some request is eventually 429'd`) is what the mutation test for a REMOVED limiter
 * mount would break — if hook-events' mount were deleted entirely, its requests would
 * bypass `cheapReadLimiter` altogether and never draw from (or benefit from) the other
 * block's exhaustion, so block 3 would still correctly fail with no 429s ever
 * appearing. What the bleed DOES mean: block 3's "some non-GET is 429'd" passing is
 * not independent proof that hook-events' specific mount is doing the throttling in
 * isolation — it may simply be riding block 2's already-spent budget. That's an
 * accepted precision loss, not a false-pass risk for the regression these tests exist
 * to catch.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { app } from '../index.js'

describe('rate limiter mount order vs controlGate (S7)', () => {
  const ORIGINAL_ENABLED = process.env.CAST_DASHBOARD_CONTROL
  const ORIGINAL_TOKEN = process.env.DASHBOARD_TOKEN

  beforeEach(() => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = 'correct-token-xyz'
  })

  afterEach(() => {
    if (ORIGINAL_ENABLED === undefined) delete process.env.CAST_DASHBOARD_CONTROL
    else process.env.CAST_DASHBOARD_CONTROL = ORIGINAL_ENABLED
    if (ORIGINAL_TOKEN === undefined) delete process.env.DASHBOARD_TOKEN
    else process.env.DASHBOARD_TOKEN = ORIGINAL_TOKEN
  })

  it('throttles repeated invalid-token POSTs to a gated prefix with 429s, not unlimited 403s', async () => {
    // /api/control shares the 5-req/60s destructiveLimiter instance. Send 15 —
    // well past the budget — with a wrong token on every request.
    const statusCounts: Record<number, number> = {}
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/control/__rate_limit_probe__')
        .set('X-Dashboard-Token', 'wrong-token')
        .send({})
      statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
    }

    // Nothing but 403 (bad token, correctly reached) or 429 (rate limited) should ever
    // come back — anything else means the request didn't reach controlGate/the limiter
    // the way this test expects.
    for (const status of Object.keys(statusCounts).map(Number)) {
      expect([403, 429]).toContain(status)
    }

    // The core assertion: once the limiter's budget (5) is spent, later guesses must
    // be 429, not more free 403s. If the limiter were mounted AFTER controlGate,
    // controlGate's 403 fires first on every single request and NO 429 ever appears —
    // this is exactly what the corrupted (reordered) version of index.ts produces.
    expect(statusCounts[429]).toBeGreaterThan(0)
    expect(statusCounts[403] ?? 0).toBeLessThanOrEqual(5)
    // Pin the OTHER half too: some requests must actually reach controlGate and get a
    // real 403, not just any-429. Without this, an always-429 limiter (e.g. one with
    // `max: 0`, or one that swallowed every request before the gate ever ran) would
    // satisfy the assertions above despite never actually exercising controlGate's
    // token check at all.
    expect(statusCounts[403] ?? 0).toBeGreaterThan(0)

    // MUTATION TEST (manually verified, not left in the tree): move the
    // `app.use('/api/control', destructiveLimiter)` mount (and its siblings) to AFTER
    // the `for (const prefix of GATED_PREFIXES) { app.use(prefix, controlGate) }` loop
    // in server/index.ts. With that ordering, all 15 requests come back 403 —
    // `statusCounts` is `{ 403: 15 }`, `statusCounts[429]` is `undefined`, and
    // `expect(statusCounts[429]).toBeGreaterThan(0)` fails with
    // "expected undefined to be greater than 0". The new `statusCounts[403] >
    // 0` assertion above does NOT catch this mutation on its own (403 is still
    // present, just all 15 of them) — it exists to guard the opposite failure mode
    // (an always-429 limiter), so both assertions together pin both halves.
  })
})

// S7 follow-up: /api/agents (and /api/rules, /api/hook-events) mount `cheapReadLimiter`,
// which skips SAFE_METHODS (GET/HEAD/OPTIONS) — see server/index.ts. Ordinary browsing
// (e.g. SystemView expanding several of the 27 registered agents, each firing its own
// GET /api/agents/:name with no cross-name staleTime dedup) must never be 429'd, while
// the actual DASHBOARD_TOKEN brute-force surface (non-GET requests) must still be
// throttled exactly like every other gated prefix.
describe('cheapReadLimiter skips SAFE_METHODS on /api/agents (S7 follow-up)', () => {
  it('never 429s repeated GETs, but still throttles non-GET requests', async () => {
    // 15 consecutive GETs — comfortably more than cheapReadLimiter's 10/min budget.
    // `skip` means none of these should ever count against it, so none should 429.
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get('/api/agents')
      expect(res.status).not.toBe(429)
    }

    // Non-GET requests to the same prefix are NOT skipped, so the same 10/min budget
    // applies to them. What controlGate does with a passed-through request (404 when
    // disabled, 403 on a bad token, etc.) is irrelevant here — the only thing under
    // test is whether the LIMITER's own counter still engages and eventually 429s,
    // since a `skip` predicate that accidentally matched non-GET methods too would
    // silently remove throttling from the actual brute-force surface.
    const statusCounts: Record<number, number> = {}
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/agents/__rate_limit_probe__').send({})
      statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
    }
    expect(statusCounts[429]).toBeGreaterThan(0)

    // MUTATION TEST (manually verified, not left in the tree): remove the
    // `skip: (req) => SAFE_METHODS.has(req.method)` line from `cheapReadLimiter` in
    // server/index.ts. With it gone, GETs count against the budget like everything
    // else — the 11th GET in the loop above comes back 429, and
    // `expect(res.status).not.toBe(429)` fails with
    // "expected 429 not to be 429" partway through the GET loop, before the
    // non-GET assertion is ever reached.
  })
})

// S7 follow-up 2: /api/hook-events also mounts cheapReadLimiter, and its GET side is
// especially sensitive — src/api/useHookEvents.ts opens a `new EventSource
// ('/api/hook-events/stream')` that auto-reconnects on error at ~3s (~20 attempts/min).
// Against a 10/min bucket that isn't a near-miss, and it's self-reinforcing: a 429 IS a
// connection error, so EventSource retries, gets 429 again, and the feed stays dead
// until the window rolls. Deliberately probes GET /recent, NOT GET /stream — /stream is
// an SSE handler that holds the connection open and would hang supertest without an
// explicit abort/timeout; /recent exercises the same limiter mount and skip predicate
// without that complication.
describe('cheapReadLimiter skips SAFE_METHODS on /api/hook-events (S7 follow-up 2)', () => {
  it('never 429s repeated GETs to /recent, but still throttles non-GET requests', async () => {
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get('/api/hook-events/recent')
      expect(res.status).not.toBe(429)
    }

    const statusCounts: Record<number, number> = {}
    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/hook-events/__rate_limit_probe__').send({})
      statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
    }
    expect(statusCounts[429]).toBeGreaterThan(0)

    // MUTATION TEST (manually verified, not left in the tree): same mutation as the
    // /api/agents block above (remove `skip` from `cheapReadLimiter`) — the 11th
    // GET /recent in the loop above fails with "expected 429 not to be 429".
  })
})

// S4 pin: /api/cast/worktrees deliberately does NOT skip SAFE_METHODS — its GET spawns
// a `git` subprocess per request (see server/routes/agentRuns.ts), so throttling GET
// there IS the S4 fix. Right now the only thing preventing someone from "simplifying"
// by adding `skip: SAFE_METHODS` to the shared `controlLimiter` (which also covers this
// prefix) is a comment in server/index.ts — nothing in the suite asserts it, so that
// mistake would ship with a fully green test run. This test is that assertion.
//
// Uses `controlLimiter` in THIS file for the first time — no other describe block here
// mounts a prefix that uses it, so there is no risk of an already-spent shared budget
// (see the file-header note on cheapReadLimiter's cross-block sharing) making this test
// pass for the wrong reason. Still, per the same caution, this asserts BOTH halves
// (some 200s AND some 429s) rather than just "some 429 appears" — if a future change
// gives `/api/cast/worktrees` its own dedicated limiter mounted earlier in the same
// file, or something else pre-spends `controlLimiter`'s budget before this test runs,
// an already-exhausted bucket would produce all-429 and this would fail loudly instead
// of silently passing on a fluke.
describe('controlLimiter still throttles /api/cast/worktrees GETs (S4 pin)', () => {
  it('429s once the shared 10/min budget is spent, after some 200s', async () => {
    const statusCounts: Record<number, number> = {}
    for (let i = 0; i < 15; i++) {
      const res = await request(app).get('/api/cast/worktrees')
      statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
    }
    // worktreesRouter always replies 200 (even a git failure is caught and replied
    // as `{ worktrees: [] }` with 200 — see agentRuns.ts) — so any non-429 response
    // under budget is 200; anything else means this test isn't exercising what it
    // thinks it is.
    for (const status of Object.keys(statusCounts).map(Number)) {
      expect([200, 429]).toContain(status)
    }
    expect(statusCounts[200] ?? 0).toBeGreaterThan(0)
    expect(statusCounts[429] ?? 0).toBeGreaterThan(0)

    // MUTATION TEST (manually verified, not left in the tree): add
    // `skip: (req) => SAFE_METHODS.has(req.method)` to `controlLimiter` in
    // server/index.ts — exactly the "simplify for consistency" mistake this test
    // exists to catch. With it added, all 15 GETs return 200 and `statusCounts[429]`
    // is `undefined`, failing `expect(statusCounts[429] ?? 0).toBeGreaterThan(0)`
    // with "expected 0 to be greater than 0".
  })
})
