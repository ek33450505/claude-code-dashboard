/**
 * Durable guard for the "compound path leak" bug class found three separate
 * times by manual inspection: a filesystem path under ~/.claude/projects/
 * embeds the username TWICE — once as a leading real-home prefix
 * (/Users/alice/...) and once inside Claude Code's encoded project-directory
 * name (-Users-alice-Projects-...), which shows up mid-string even after the
 * leading prefix is stripped. A boundary that applies only relativizeHome()
 * (leading-prefix only) or only maskProjectKey() (encoded-form only) leaves
 * the value half-redacted. redactPath() (server/utils/projectKey.ts) composes
 * both and is the fix under test here.
 *
 * Each route below is mounted over a small in-memory/mocked fixture built
 * from a FAKE home (os.homedir() spied to /Users/testuser) so the assertions
 * are deterministic and never depend on whoever runs the suite. The fixture
 * data deliberately contains both leak shapes; the assertions check the
 * serialized JSON response contains neither the raw fixture home nor the
 * fake username in any form.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import os from 'os'
import path from 'path'
import express from 'express'
import request from 'supertest'
import Database from 'better-sqlite3'

const FAKE_HOME = '/Users/testuser'
const ENCODED_FAKE_HOME = '-Users-testuser'
// Realistic shape: already-leading-relativized (as compactionEvents/memory.ts
// would leave it) but still carrying the encoded segment mid-string — this is
// exactly the half-fixed value a bare relativizeHome() would produce.
const LEAKY_TRANSCRIPT_PATH =
  `${FAKE_HOME}/.claude/projects/${ENCODED_FAKE_HOME}-Projects-personal-myapp/session-abc.jsonl`

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
  getCastDbWritable: () => null,
}))
const RAW_PROJECT_ENCODED = `${ENCODED_FAKE_HOME}-Projects-personal-myapp`

vi.mock('../parsers/sessions.js', () => ({
  getCachedSessions: () => [
    {
      id: 'sess-1',
      project: 'myapp',
      projectPath: path.join(FAKE_HOME, 'Projects', 'personal', 'myapp'),
      projectEncoded: RAW_PROJECT_ENCODED,
      startedAt: '2026-01-01T00:00:00Z',
    },
  ],
  loadSession: vi.fn((projectEncoded: string, sessionId: string) => {
    if (projectEncoded !== RAW_PROJECT_ENCODED || sessionId !== 'sess-1') return []
    return [
      {
        parentUuid: null,
        uuid: 'u1',
        type: 'user',
        timestamp: '2026-01-01T00:00:00Z',
        slug: 'export-leak-check',
        message: { role: 'user', content: 'hello there' },
      },
      {
        parentUuid: 'u1',
        uuid: 'u2',
        type: 'assistant',
        timestamp: '2026-01-01T00:00:05Z',
        message: {
          role: 'assistant',
          content: 'hi back',
          model: 'claude-sonnet-5',
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      },
    ]
  }),
}))
// resolveProjectKey() normally resolves via a real fs.readdirSync(PROJECTS_DIR)
// lookup, which would require an actual directory on disk under the mocked
// FAKE_HOME. Partial-mock it (importOriginal keeps the real maskProjectKey,
// which the GET /api/sessions test below depends on) so the /export test can
// resolve RAW_PROJECT_ENCODED without touching the filesystem.
vi.mock('../utils/projectKey.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/projectKey.js')>()
  return {
    ...actual,
    resolveProjectKey: (key: string) =>
      key === RAW_PROJECT_ENCODED || actual.maskProjectKey(RAW_PROJECT_ENCODED) === key
        ? RAW_PROJECT_ENCODED
        : null,
  }
})
vi.mock('../parsers/agents.js', () => ({ loadAgents: () => [] }))
vi.mock('../parsers/memory.js', () => ({
  loadPlans: () => [],
  loadAgentMemory: () => [],
  // Simulates loadProjectMemory()'s legacy ~/.claude/projects/<encoded>/memory
  // branch (server/parsers/memory.ts loadProjectMemory, branch 3): `agent` is
  // the raw encoded project-directory name, and `path` is leading-relativized
  // but still carries the encoded segment mid-string.
  loadProjectMemory: () => [
    {
      agent: `${ENCODED_FAKE_HOME}-Projects-personal-myapp`,
      path: `~/.claude/projects/${ENCODED_FAKE_HOME}-Projects-personal-myapp/memory/note.md`,
      name: 'leak-guard-memory',
      description: 'leak guard test fixture',
      type: 'project',
      body: 'irrelevant',
      modifiedAt: '2026-01-01T00:00:00Z',
    },
  ],
}))

let testDb: ReturnType<typeof Database> | null = null

const { compactionEventsRouter } = await import('../routes/compactionEvents.js')
const { searchRouter } = await import('../routes/search.js')
const { sessionsRouter } = await import('../routes/sessions.js')

const compactionApp = express()
compactionApp.use('/api/cast/compaction-events', compactionEventsRouter)

const searchApp = express()
searchApp.use('/api/search', searchRouter)

const sessionsApp = express()
sessionsApp.use('/api/sessions', sessionsRouter)

function createCompactionDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE compaction_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      timestamp TEXT NOT NULL,
      trigger TEXT,
      compaction_tier TEXT,
      transcript_path TEXT
    )
  `)
  db.prepare(
    `INSERT INTO compaction_events (id, session_id, timestamp, trigger, compaction_tier, transcript_path)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run('evt-1', 'sess-1', '2026-01-01T00:00:00Z', 'auto', null, LEAKY_TRANSCRIPT_PATH)
  return db
}

/** Assert a serialized JSON body carries neither leak shape. */
function assertNoLeak(body: unknown) {
  const json = JSON.stringify(body)
  expect(json).not.toContain('testuser')
  expect(json).not.toContain(FAKE_HOME)
  expect(json).not.toContain(ENCODED_FAKE_HOME)
}

describe('no-username-leak guard — compound path redaction', () => {
  beforeEach(() => {
    vi.spyOn(os, 'homedir').mockReturnValue(FAKE_HOME)
    testDb = createCompactionDb()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    testDb?.close()
    testDb = null
  })

  it('GET /api/cast/compaction-events redacts transcript_path fully', async () => {
    const res = await request(compactionApp).get('/api/cast/compaction-events')
    expect(res.status).toBe(200)
    expect(res.body.events).toHaveLength(1)
    assertNoLeak(res.body)
    expect(res.body.events[0].transcript_path).toBe(
      '~/.claude/projects/~-Projects-personal-myapp/session-abc.jsonl'
    )
  })

  it('GET /api/search redacts memories[].agent and memories[].path fully', async () => {
    const res = await request(searchApp).get('/api/search').query({ q: 'leak-guard' })
    expect(res.status).toBe(200)
    expect(res.body.memories).toHaveLength(1)
    assertNoLeak(res.body)
    expect(res.body.memories[0].agent).toBe('~-Projects-personal-myapp')
    expect(res.body.memories[0].path).toBe('~/.claude/projects/~-Projects-personal-myapp/memory/note.md')
  })

  it('GET /api/sessions redacts projectPath and projectEncoded (regression coverage)', async () => {
    const res = await request(sessionsApp).get('/api/sessions')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    assertNoLeak(res.body)
  })

  // GET /:projectEncoded/:sessionId/export was NOT covered by the assertions
  // above, which is why its leak (server/routes/sessions.ts:130 doing
  // `decodeURIComponent(rawProjectEncoded).split('/').pop() || rawProjectEncoded`
  // against a hyphen-encoded — not slash-delimited — dir name, so `.pop()`
  // returned the WHOLE encoded string, username included, with the `||`
  // fallback leaking the same value a second way) survived the earlier sweep.
  it('GET /:projectEncoded/:sessionId/export redacts the rendered Project line', async () => {
    const maskedKey = `~-Projects-personal-myapp`
    const res = await request(sessionsApp).get(
      `/api/sessions/${encodeURIComponent(maskedKey)}/sess-1/export`
    )
    expect(res.status).toBe(200)
    const body: string = res.body.body
    expect(body).not.toContain('testuser')
    expect(body).not.toContain(`-Users-testuser-`)
    expect(body).not.toContain(FAKE_HOME)
    // Human-readable project name still renders correctly — decodeProjectPath()
    // resolves the raw encoded dir name to its final path segment, same
    // derivation as sse.ts:392's projectName.
    expect(body).toContain('**Project:** myapp')
  })

  // NOTE: the SSE broadcast surface (server/watchers/sse.ts, three `path:` sites now using
  // redactPath) is deliberately NOT covered here. A test that calls redactPath() directly would
  // pass even if sse.ts were reverted to relativizeHome — it would assert the helper, which
  // projectKey.test.ts already covers, not the wiring. Closing this properly means mounting the
  // watcher and reading the emitted event, reusing sseEventPathRelativize.test.ts's harness with
  // os.homedir() mocked. Tracked as an open gap rather than papered over with a false proxy.

})
