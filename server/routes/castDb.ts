import Database from 'better-sqlite3'
import fs from 'fs'
import { CAST_DB } from '../constants.js'

// cast.db is written concurrently by the CAST flagship's hooks (routing, agent_runs,
// dispatch_decisions inserts fire out-of-process while the dashboard reads/writes).
// Without busy_timeout, a read that lands mid-write-transaction gets SQLITE_BUSY
// immediately instead of waiting for the writer to finish. Applied to BOTH connections:
// the readonly one (dashboard reads racing a flagship write) and the writable one
// (dashboard writes racing a flagship write, or vice versa) — either direction can hit
// a busy lock. 8000ms is generous relative to a single INSERT/UPDATE transaction
// (sub-millisecond in practice) while staying well under typical HTTP client timeouts,
// so a request waits out a lock instead of failing on ordinary contention. Deliberately
// NOT the better-sqlite3 default (also 5000ms as of the version pinned here) — picking
// a distinct value keeps the test in castDb.test.ts meaningful (asserting on the
// library default would pass whether or not this pragma call executes at all).
const BUSY_TIMEOUT_MS = 8000

let _db: ReturnType<typeof Database> | null = null
// inode of the file backing _db, captured when the connection was opened. Used by
// invalidateCastDbIfChanged() to detect the flagship's prune/backup path swapping
// cast.db out from under a live connection (see that function for why the check
// lives there and not here).
let _dbIno: number | null = null

export function getCastDb(): ReturnType<typeof Database> | null {
  if (!fs.existsSync(CAST_DB)) return null
  if (!_db) {
    _db = new Database(CAST_DB, { readonly: true, fileMustExist: true })
    _db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)
    try {
      _dbIno = fs.statSync(CAST_DB).ino
    } catch {
      _dbIno = null
    }
  }
  return _db
}

/** Open a fresh read-write connection to cast.db. Caller MUST close it when done. */
export function getCastDbWritable(): ReturnType<typeof Database> | null {
  if (!fs.existsSync(CAST_DB)) return null
  const db = new Database(CAST_DB, { fileMustExist: true })
  db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`)
  return db
}

/** Close the cached readonly connection (if any) and clear cached state. Safe to call
 *  when no connection is open. Used on process shutdown (server/index.ts) and when
 *  invalidateCastDbIfChanged() detects the underlying file has been replaced. */
export function closeCastDb(): void {
  if (_db) {
    try {
      _db.close()
    } catch {
      /* already closed */
    }
    _db = null
    _dbIno = null
  }
}

/** Detect whether cast.db on disk has been replaced since the cached connection was
 *  opened (different inode — e.g. the flagship's prune/backup path swaps the file
 *  rather than writing in place) and close the stale connection so the next
 *  getCastDb() call reopens against the current file.
 *
 *  Deliberately NOT called from getCastDb() itself: getCastDb() runs on essentially
 *  every dashboard request, and an fs.statSync() on every one of those would be a real
 *  per-request cost for a condition that changes rarely (only around a prune/backup).
 *  Instead this is called once per castDbWatcher poll tick (every 3s, see
 *  server/watchers/castDbWatcher.ts), which already touches the DB on the same
 *  cadence — bounding staleness to at most one poll interval at negligible added cost. */
export function invalidateCastDbIfChanged(): void {
  if (!_db) return
  try {
    const currentIno = fs.statSync(CAST_DB).ino
    if (_dbIno !== null && currentIno !== _dbIno) {
      closeCastDb()
    }
  } catch {
    // CAST_DB missing or unreadable — leave the cached connection as-is; getCastDb's
    // existsSync guard and normal query-time errors handle that case elsewhere.
  }
}
