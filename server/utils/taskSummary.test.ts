import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { taskSummarySubquery } from './taskSummary.js'

// C1: single source of the task_summary correlated subquery, replacing 9 copy-pasted
// call sites. Covers the legacy/modern dispatch_decisions schema split (dispatch_name
// column added in flagship migration 033) and the identity-matching fix itself:
// resolving via dispatch_name (full dispatch name, e.g. `backend-writer__u5`) in
// addition to the pre-existing chosen_agent (bare roster type) match.

function makeLegacyDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE agent_runs (
      id INTEGER PRIMARY KEY,
      session_id TEXT,
      agent TEXT,
      started_at TEXT
    );
    CREATE TABLE dispatch_decisions (
      id INTEGER PRIMARY KEY,
      session_id TEXT,
      prompt_snippet TEXT,
      chosen_agent TEXT,
      created_at TEXT
    );
  `)
  return db
}

function makeModernDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE agent_runs (
      id INTEGER PRIMARY KEY,
      session_id TEXT,
      agent TEXT,
      started_at TEXT
    );
    CREATE TABLE dispatch_decisions (
      id INTEGER PRIMARY KEY,
      session_id TEXT,
      prompt_snippet TEXT,
      chosen_agent TEXT,
      dispatch_name TEXT,
      created_at TEXT
    );
  `)
  return db
}

describe('taskSummarySubquery', () => {
  it('legacy schema (no dispatch_name column): fragment omits dispatch_name and executes cleanly', () => {
    const db = makeLegacyDb()
    const fragment = taskSummarySubquery(db)
    expect(fragment).not.toContain('dispatch_name')
    expect(fragment).toContain('AS task_summary')

    // Regression guard: an earlier attempt at this change broke 28 existing tests with
    // "SqliteError: no such column: dd.dispatch_name" on legacy fixtures.
    expect(() => {
      db.prepare(`SELECT ar.id, ${fragment} FROM agent_runs ar`).all()
    }).not.toThrow()
  })

  it('modern schema: fragment contains COALESCE and references both identity columns', () => {
    const db = makeModernDb()
    const fragment = taskSummarySubquery(db)
    expect(fragment).toContain('COALESCE')
    expect(fragment).toContain('dd.dispatch_name = ar.agent')
    expect(fragment).toContain('dd.chosen_agent = ar.agent')
  })

  it('alias defaults to task_summary', () => {
    const db = makeLegacyDb()
    expect(taskSummarySubquery(db)).toContain('AS task_summary')
  })

  it('alias can be overridden (e.g. prompt_preview for the routing route)', () => {
    const db = makeLegacyDb()
    expect(taskSummarySubquery(db, 'prompt_preview')).toContain('AS prompt_preview')
  })

  it('throws on an unsafe alias', () => {
    const db = makeLegacyDb()
    expect(() => taskSummarySubquery(db, 'x; DROP TABLE t')).toThrow()
  })

  describe('behavioral resolution against a modern in-memory DB', () => {
    function seed(db: Database.Database) {
      db.prepare(`
        INSERT INTO agent_runs (id, session_id, agent, started_at)
        VALUES
          (1, 's1', 'backend-writer__u5', '2026-09-02T16:00:00Z'),
          (2, 's1', 'backend-writer', '2026-09-02T16:05:00Z'),
          (3, 's1', 'code-reviewer', '2026-09-02T16:10:00Z')
      `).run()
      db.prepare(`
        INSERT INTO dispatch_decisions (id, session_id, prompt_snippet, chosen_agent, dispatch_name, created_at)
        VALUES
          -- (a) matches run 1 ONLY via dispatch_name (full dispatch name) — the case
          -- that failed before this fix (0/959 named-dispatch runs resolved).
          (1, 's1', 'named dispatch snippet', 'backend-writer', 'backend-writer__u5', '2026-09-02 15:59:30'),
          -- (b) matches run 2 ONLY via chosen_agent (bare roster type, old-era row —
          -- dispatch_name is NULL because it was never a named dispatch).
          (2, 's1', 'bare roster snippet', 'backend-writer', NULL, '2026-09-02 16:04:30'),
          -- (c) candidate for run 3, but created_at is > 60s AFTER run 3's started_at —
          -- outside the window, must resolve NULL.
          (3, 's1', 'too-late snippet', 'code-reviewer', NULL, '2026-09-02 16:11:30')
      `).run()
    }

    it('(a) resolves a new-era run whose agent is a full dispatch name via dispatch_name', () => {
      const db = makeModernDb()
      seed(db)
      const fragment = taskSummarySubquery(db)
      const row = db.prepare(`SELECT ar.id, ${fragment} FROM agent_runs ar WHERE ar.id = 1`).get() as { task_summary: string | null }
      expect(row.task_summary).toBe('named dispatch snippet')
    })

    it('(b) resolves an old-era run whose agent is the bare roster type via chosen_agent', () => {
      const db = makeModernDb()
      seed(db)
      const fragment = taskSummarySubquery(db)
      const row = db.prepare(`SELECT ar.id, ${fragment} FROM agent_runs ar WHERE ar.id = 2`).get() as { task_summary: string | null }
      expect(row.task_summary).toBe('bare roster snippet')
    })

    it('(c) resolves NULL when the only candidate decision is outside the 60s window', () => {
      const db = makeModernDb()
      seed(db)
      const fragment = taskSummarySubquery(db)
      const row = db.prepare(`SELECT ar.id, ${fragment} FROM agent_runs ar WHERE ar.id = 3`).get() as { task_summary: string | null }
      expect(row.task_summary).toBeNull()
    })
  })
})
