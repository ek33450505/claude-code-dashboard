/**
 * S6 follow-up — server/routes/search.ts used to call `relativizeHome(m.path)`
 * itself on memory results. Now that loadAgentMemory()/loadProjectMemory()
 * (server/parsers/memory.ts) already relativize `path` before returning it,
 * that second call was redundant (idempotent, since a `~`-prefixed string
 * never starts with the real `os.homedir()`, but still dead code) and has been
 * removed — search.ts now passes `m.path` straight through.
 */
import { describe, it, expect, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../parsers/sessions.js', () => ({ getCachedSessions: () => [] }))
vi.mock('../parsers/agents.js', () => ({ loadAgents: () => [] }))
vi.mock('../parsers/memory.js', () => ({
  loadPlans: () => [],
  loadAgentMemory: () => [
    {
      agent: 'code-reviewer',
      path: '~/.claude/agent-memory-local/code-reviewer/feedback.md',
      name: 'feedback-search-match',
      description: 'search match test',
      type: 'feedback',
      body: 'irrelevant',
      modifiedAt: '2026-03-30T15:45:00Z',
    },
  ],
  loadProjectMemory: () => [
    {
      agent: 'planner',
      path: 'cast-db:5',
      name: 'db-search-match',
      description: 'search match test',
      type: 'project',
      body: 'irrelevant',
      modifiedAt: '2026-03-30T15:45:00Z',
    },
  ],
}))

const { searchRouter } = await import('../routes/search.js')

const app = express()
app.use('/api/search', searchRouter)

describe('GET /api/search — memory path pass-through (no double relativization)', () => {
  it('returns the already-relativized filesystem path unchanged', async () => {
    const res = await request(app).get('/api/search').query({ q: 'search match' })

    expect(res.status).toBe(200)
    const fsMatch = res.body.memories.find((m: { name: string }) => m.name === 'feedback-search-match')
    expect(fsMatch).toBeDefined()
    // Passed straight through — no ~/~/ double-prefix, no reversion to absolute.
    expect(fsMatch.path).toBe('~/.claude/agent-memory-local/code-reviewer/feedback.md')
  })

  it('returns a non-filesystem cast-db key unchanged', async () => {
    const res = await request(app).get('/api/search').query({ q: 'search match' })

    expect(res.status).toBe(200)
    const dbMatch = res.body.memories.find((m: { name: string }) => m.name === 'db-search-match')
    expect(dbMatch).toBeDefined()
    expect(dbMatch.path).toBe('cast-db:5')

    // MUTATION TEST (manually verified, not left in the tree): re-add
    // `path: relativizeHome(m.path)` in search.ts (restoring the removed double
    // call). Since relativizeHome() is idempotent for an already-relativized or
    // non-fs value, both assertions above still pass — which is exactly why this
    // was dead code rather than a bug. The real regression this guards is
    // accidentally swapping back to `path: m.path` reading some OTHER absolute
    // field; reverting `path: m.path,` to `path: undefined,` (simulating the
    // field being dropped) makes the fsMatch.path assertion above fail with
    // `undefined` instead of the expected string, proving the field is actually
    // wired through.
  })
})
