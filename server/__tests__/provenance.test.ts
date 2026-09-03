import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import request from 'supertest'

let testDb: ReturnType<typeof Database> | null = null

vi.mock('../routes/castDb.js', () => ({
  getCastDb: () => testDb,
}))

const { provenanceChainRouter, commitProvenanceRouter, attestationsRouter } = await import('../routes/provenance.js')

const chainApp = express()
chainApp.use('/', provenanceChainRouter)
const commitsApp = express()
commitsApp.use('/', commitProvenanceRouter)
const attestationsApp = express()
attestationsApp.use('/', attestationsRouter)

beforeEach(() => {
  testDb = new Database(':memory:')
  testDb.exec(`
    CREATE TABLE provenance_chain (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      prev_hash TEXT,
      session_digest TEXT NOT NULL,
      chain_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      receipt_json TEXT
    );
    CREATE TABLE commit_provenance (
      sha TEXT PRIMARY KEY,
      session_id TEXT,
      agent TEXT NOT NULL DEFAULT 'commit',
      branch TEXT,
      repo TEXT,
      recorded_at TEXT NOT NULL
    );
    CREATE TABLE attestations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_key TEXT,
      false_done INTEGER DEFAULT 0,
      payload TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
    );
  `)
})

afterEach(() => {
  testDb?.close()
  testDb = null
})

describe('GET /api/cast/provenance-chain', () => {
  it('returns an empty envelope when the table has no rows', async () => {
    const res = await request(chainApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ chain: [] })
  })

  it('marks a row with receipt_json as verified, and one without as unverifiable (pre-migration-035 default, not "broken")', async () => {
    testDb!.prepare(`
      INSERT INTO provenance_chain (session_id, prev_hash, session_digest, chain_hash, created_at, receipt_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-1', null, 'digest-1', 'hash-1', '2026-08-01 00:00:00', '{"ok":true}')
    testDb!.prepare(`
      INSERT INTO provenance_chain (session_id, prev_hash, session_digest, chain_hash, created_at, receipt_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('sess-2', 'hash-1', 'digest-2', 'hash-2', '2026-08-01 00:00:01', null)

    const res = await request(chainApp).get('/')

    expect(res.status).toBe(200)
    const byDigest = Object.fromEntries(
      (res.body.chain as Array<{ session_digest: string; verification_state: string }>).map((r) => [r.session_digest, r.verification_state])
    )
    expect(byDigest['digest-1']).toBe('verified')
    expect(byDigest['digest-2']).toBe('unverifiable')

    // MUTATION CHECK (manually verified, not left in tree): invert the ternary in
    // provenance.ts's mapRow (`r.receipt_json === null ? 'verified' : 'unverifiable'`)
    // — both assertions above then fail.
  })
})

describe('GET /api/cast/commit-provenance', () => {
  it('returns rows ordered by recorded_at DESC', async () => {
    testDb!.prepare(`INSERT INTO commit_provenance (sha, session_id, agent, branch, repo, recorded_at) VALUES (?,?,?,?,?,?)`)
      .run('sha1', 'sess-1', 'commit', 'main', 'repo', '2026-08-01T00:00:00Z')
    testDb!.prepare(`INSERT INTO commit_provenance (sha, session_id, agent, branch, repo, recorded_at) VALUES (?,?,?,?,?,?)`)
      .run('sha2', 'sess-2', 'commit', 'main', 'repo', '2026-08-02T00:00:00Z')

    const res = await request(commitsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.commits.map((c: { sha: string }) => c.sha)).toEqual(['sha2', 'sha1'])
  })
})

describe('GET /api/cast/attestations', () => {
  it('returns an empty envelope when the table has no rows', async () => {
    const res = await request(attestationsApp).get('/')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ attestations: [] })
  })

  it('returns rows with false_done flag intact', async () => {
    testDb!.prepare(`INSERT INTO attestations (agent_key, false_done, payload, created_at) VALUES (?,?,?,?)`)
      .run('agent-1', 1, '{}', '2026-08-01T00:00:00Z')

    const res = await request(attestationsApp).get('/')

    expect(res.status).toBe(200)
    expect(res.body.attestations[0].false_done).toBe(1)
  })
})
