import type Database from 'better-sqlite3'

/**
 * True if `name` is a table in the connected DB. Binds the name as a parameter rather than
 * interpolating it, so it is safe for user-supplied values as well as literals.
 *
 * Replaces 35 hand-rolled `SELECT name FROM sqlite_master` probes across 25 files.
 */
export function tableExists(db: ReturnType<typeof Database>, name: string): boolean {
  try {
    return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) !== undefined
  } catch {
    return false
  }
}
