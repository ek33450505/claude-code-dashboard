/**
 * S6 follow-up — Session.projectPath (server/parsers/sessions.ts) is the fully
 * decoded, absolute local filesystem path (e.g. reconstructed from the encoded
 * ~/.claude/projects/<encoded> directory name). GET /api/sessions is the
 * dashboard's primary, public/unauthenticated session list and returned it
 * verbatim on every session.
 *
 * projectPath must stay absolute inside getCachedSessions()/listSessions()
 * itself: server/routes/seed.ts calls listSessions() directly and writes
 * session.projectPath into cast.db's sessions.project_root column — relativizing
 * in the parser would corrupt that DB write. Relativized only at this route's
 * response boundary instead.
 *
 * Frontend consumer check: src/views/SessionsView.tsx is the only consumer
 * (grepped `\.projectPath\b` across src/) — it calls
 * `extractProjectName(projectPath)`, which does
 * `projectPath.split('/').pop()` (last path segment) for filtering, grouping,
 * and search matching. Relativizing only ever rewrites the home-directory
 * PREFIX of the path, never its trailing segment, so extractProjectName's
 * output — and therefore all filtering/grouping/matching built on it — is
 * unaffected.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import os from 'os'
import path from 'path'

vi.mock('../parsers/sessions.js', () => ({
  getCachedSessions: vi.fn(),
  loadSession: vi.fn(),
}))
vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => null,
  getCastDbWritable: () => null,
}))

const { getCachedSessions } = await import('../parsers/sessions.js')
const { sessionsRouter } = await import('../routes/sessions.js')

const app = express()
app.use('/api/sessions', sessionsRouter)

const PROJECT_PATH = path.join(os.homedir(), 'Projects', 'personal', 'claude-code-dashboard')

function extractProjectName(projectPath: string): string {
  if (!projectPath) return 'Unknown'
  const segments = projectPath.replace(/\/+$/, '').split('/')
  return segments[segments.length - 1] || 'Unknown'
}

describe('GET /api/sessions — S6 path relativization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a ~-prefixed projectPath with no real home dir leak', async () => {
    vi.mocked(getCachedSessions).mockReturnValue([{
      id: 'sess-1',
      project: 'claude-code-dashboard',
      projectPath: PROJECT_PATH,
      projectEncoded: '-Users-edkubiak-Projects-personal-claude-code-dashboard',
      startedAt: '2026-08-01T00:00:00Z',
      durationMs: 1000,
      messageCount: 1,
      toolCallCount: 0,
      agentCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      model: 'sonnet',
    }])

    const res = await request(app).get('/api/sessions')

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].projectPath).toBe(path.join('~', 'Projects', 'personal', 'claude-code-dashboard'))
    expect(res.body[0].projectPath).not.toContain(os.homedir())
    // extractProjectName's basename extraction is unaffected by relativization —
    // verified, not assumed (see file header).
    expect(extractProjectName(res.body[0].projectPath)).toBe('claude-code-dashboard')

    // MUTATION TEST (manually verified, not left in the tree): revert
    // `res.json(sessions.map(s => ({ ...s, projectPath: relativizeHome(s.projectPath)! })))`
    // in sessions.ts back to `res.json(sessions)`. With that corruption,
    // res.body[0].projectPath comes back as the raw absolute PROJECT_PATH and
    // both leak assertions above fail (extractProjectName still returns the
    // correct basename either way, which is exactly the point — the mutation
    // only breaks the leak assertions, confirming the fix is what closes the
    // gap, not a side effect that would also break the view).
  })
})
