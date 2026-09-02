import { describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

// D14/D15: connection lifecycle for the cast.db singleton — busy_timeout is set on
// both the readonly and writable connections, and the cached readonly connection is
// invalidated (closed + reopened) when the file on disk is replaced (different inode),
// e.g. the flagship's prune/backup path swapping the file rather than writing in
// place. Uses a real temp sqlite file (never ~/.claude/cast.db) via CAST_DB_PATH,
// which server/constants.ts reads at import time — set BEFORE importing castDb.js.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'castdb-lifecycle-'))
const dbPath = path.join(tmpDir, 'cast.db')
process.env.CAST_DB_PATH = dbPath

function writeDbFile(p: string) {
  const db = new Database(p)
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)')
  db.close()
}
writeDbFile(dbPath)

const { getCastDb, getCastDbWritable, invalidateCastDbIfChanged, closeCastDb } =
  await import('./castDb.js')

afterAll(() => {
  closeCastDb()
  delete process.env.CAST_DB_PATH
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('castDb connection lifecycle', () => {
  it('sets busy_timeout on both the readonly and writable connections (D14)', () => {
    // 8000 is intentionally distinct from better-sqlite3's own 5000ms default — see
    // the BUSY_TIMEOUT_MS comment in castDb.ts for why this matters for the test.
    const db = getCastDb()!
    expect(db.pragma('busy_timeout', { simple: true })).toBe(8000)

    const wdb = getCastDbWritable()!
    expect(wdb.pragma('busy_timeout', { simple: true })).toBe(8000)
    wdb.close()
  })

  it('reuses the same cached connection across repeated getCastDb() calls', () => {
    closeCastDb()
    const first = getCastDb()
    const second = getCastDb()
    expect(second).toBe(first)
  })

  it('invalidates the cached connection when cast.db is replaced with a new inode (D15)', () => {
    closeCastDb()
    const before = getCastDb()!
    expect(getCastDb()).toBe(before) // sanity: still cached, unchanged

    // Replace the file at the same path — unlink + recreate gets a fresh inode
    // (in-place overwrite would not).
    fs.unlinkSync(dbPath)
    writeDbFile(dbPath)

    // Without invalidation, the singleton is still stale.
    expect(getCastDb()).toBe(before)

    invalidateCastDbIfChanged()

    const after = getCastDb()!
    expect(after).not.toBe(before)
  })

  it('invalidateCastDbIfChanged is a no-op when the inode is unchanged', () => {
    closeCastDb()
    const before = getCastDb()!
    invalidateCastDbIfChanged()
    expect(getCastDb()).toBe(before)
  })

  it('closeCastDb clears the cached connection so a later getCastDb reopens', () => {
    const before = getCastDb()!
    closeCastDb()
    const after = getCastDb()!
    expect(after).not.toBe(before)
  })
})
