/**
 * Contract tests for the shared modules.
 *
 * These are the tests whose absence let v2.7.0 ship with four routes querying retired
 * tables, three routes querying dropped columns, and a pricing table that overstated
 * claude-opus-4-8 by 3x. Each one is written so that it FAILS when the thing it guards
 * regresses — see the mutation notes on individual cases.
 *
 * Tests that need the live cast.db or the flagship config skip when those are absent, so a
 * clean CI checkout stays green. `describe.skipIf` is used rather than a silent pass so the
 * skip is visible in the report.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import Database from 'better-sqlite3'

import { MODEL_RATES, DEFAULT_RATES, estimateCost, getRates, isKnownModel, CACHE_WRITE_MULTIPLIER, CACHE_READ_MULTIPLIER } from './pricing.js'
import { parseTimestamp, toEpochMs, utcDay, formatDuration, durationMsBetween, timeAgo, formatTimeOfDay } from './time.js'
import { formatCost, formatTokens } from './format.js'
import { CAST_SCHEMA, RETIRED_TABLES, RETIRED_COLUMNS, isQueryableTable } from './castSchema.js'

const CAST_DB = path.join(os.homedir(), '.claude', 'cast.db')
const FLAGSHIP_PRICING = path.join(os.homedir(), '.claude', 'config', 'model-pricing.json')
const hasDb = fs.existsSync(CAST_DB)
const hasPricing = fs.existsSync(FLAGSHIP_PRICING)

function db() {
  return new Database(CAST_DB, { readonly: true, fileMustExist: true })
}

// ── Pricing ──────────────────────────────────────────────────────────────────

describe('pricing', () => {
  it('derives cache rates from base input rather than hand-entering them', () => {
    // 1M cache-write tokens on opus-5 ($5 input) = 5 * 1.25 = $6.25 — the published rate.
    expect(estimateCost(0, 0, 1_000_000, 0, 'claude-opus-5')).toBeCloseTo(6.25, 6)
    // 1M cache-read tokens = 5 * 0.1 = $0.50 — the published rate.
    expect(estimateCost(0, 0, 0, 1_000_000, 'claude-opus-5')).toBeCloseTo(0.5, 6)
    expect(CACHE_WRITE_MULTIPLIER).toBe(1.25)
    expect(CACHE_READ_MULTIPLIER).toBe(0.1)
  })

  it('applies the Fable 5.1 cache-read exception', () => {
    // Fable 5.1 reads at 0.025x, not 0.1x: 10 * 0.025 = $0.25 per MTok.
    expect(estimateCost(0, 0, 0, 1_000_000, 'claude-fable-5-1')).toBeCloseTo(0.25, 6)
    // Fable 5 (no override) stays at 0.1x: 10 * 0.1 = $1.00.
    expect(estimateCost(0, 0, 0, 1_000_000, 'claude-fable-5')).toBeCloseTo(1.0, 6)
  })

  it('does not silently family-match an unknown model onto a wrong rate', () => {
    // The pre-v2.8 table used a `startsWith('claude-opus')` fallback, which is exactly how
    // claude-opus-5 got priced at the retired Opus 4 rate of $15/$75.
    expect(getRates('claude-opus-99')).toEqual(DEFAULT_RATES)
    expect(isKnownModel('claude-opus-99')).toBe(false)
    expect(isKnownModel('claude-opus-5')).toBe(true)
  })

  it.skipIf(!hasPricing)('matches the flagship model-pricing.json entry for entry', () => {
    const flagship = JSON.parse(fs.readFileSync(FLAGSHIP_PRICING, 'utf-8')).models as Record<
      string, { cost_per_million_input: number; cost_per_million_output: number }
    >
    const mismatches: string[] = []
    for (const [model, rates] of Object.entries(MODEL_RATES)) {
      const f = flagship[model]
      if (!f) { mismatches.push(`${model}: absent from flagship config`); continue }
      if (f.cost_per_million_input !== rates.input) {
        mismatches.push(`${model}.input: flagship ${f.cost_per_million_input} vs shared ${rates.input}`)
      }
      if (f.cost_per_million_output !== rates.output) {
        mismatches.push(`${model}.output: flagship ${f.cost_per_million_output} vs shared ${rates.output}`)
      }
    }
    expect(mismatches).toEqual([])
    expect(DEFAULT_RATES.input).toBe(flagship._default.cost_per_million_input)
    expect(DEFAULT_RATES.output).toBe(flagship._default.cost_per_million_output)
  })

  it.skipIf(!hasDb)('has an explicit rate for every model in the live record', () => {
    // The test that would have caught claude-sonnet-5 and claude-opus-5 pricing off a
    // stale family fallback. Mutation-check: delete the claude-sonnet-5 entry -> fails.
    const conn = db()
    try {
      const models = conn
        .prepare("SELECT DISTINCT model FROM agent_runs WHERE model IS NOT NULL AND model <> ''")
        .all() as Array<{ model: string }>
      const unpriced = models.map(r => r.model).filter(m => !isKnownModel(m))
      expect(unpriced).toEqual([])
    } finally { conn.close() }
  })
})

// ── Timestamps ───────────────────────────────────────────────────────────────

describe('time', () => {
  it('reads SQLite space format as UTC, not local', () => {
    // The whole reason parseTimestamp exists: `new Date('2026-09-01 23:45:30')` is LOCAL.
    expect(parseTimestamp('2026-09-01 23:45:30')).toBe('2026-09-01T23:45:30Z')
    expect(toEpochMs('2026-09-01 23:45:30')).toBe(Date.UTC(2026, 8, 1, 23, 45, 30))
  })

  it('handles all four live encodings', () => {
    expect(toEpochMs('2026-09-01T23:45:30Z')).toBe(Date.UTC(2026, 8, 1, 23, 45, 30))          // A
    expect(toEpochMs('2026-09-01T23:45:30.500000+00:00')).toBe(Date.UTC(2026, 8, 1, 23, 45, 30, 500)) // B
    expect(toEpochMs('2026-09-01 23:45:30')).toBe(Date.UTC(2026, 8, 1, 23, 45, 30))           // C
    expect(toEpochMs(1783100402)).toBe(1783100402 * 1000)                                      // D
    expect(toEpochMs('1783100402')).toBe(1783100402 * 1000)                                    // D as text
  })

  it('pins a zoneless ISO string to UTC', () => {
    // JS parses 'YYYY-MM-DDTHH:MM:SS' with no zone as LOCAL — same trap as format C.
    expect(toEpochMs('2026-09-01T23:45:30')).toBe(Date.UTC(2026, 8, 1, 23, 45, 30))
  })

  it('returns null rather than Invalid Date or the epoch', () => {
    expect(parseTimestamp(null)).toBeNull()
    expect(parseTimestamp('')).toBeNull()
    expect(parseTimestamp('   ')).toBeNull()
    expect(toEpochMs(0)).toBeNull()
    expect(toEpochMs(undefined)).toBeNull()
  })

  it('formats durations and spans', () => {
    expect(formatDuration(null)).toBe('--')
    expect(formatDuration(500)).toBe('<1s')
    expect(formatDuration(90_000)).toBe('1m 30s')
    expect(formatDuration(5_400_000)).toBe('1h 30m')
    expect(durationMsBetween('2026-09-01T00:00:00Z', '2026-09-01 00:01:00')).toBe(60_000)
    expect(durationMsBetween('2026-09-01T00:00:00Z', null)).toBeNull()
  })

  it('derives the UTC day key used by the *_daily rollups', () => {
    expect(utcDay('2026-09-01T23:45:30Z')).toBe('2026-09-01')
    expect(utcDay('2026-09-01 23:45:30')).toBe('2026-09-01')
  })


  // Ported from the retired src/utils/time.test.ts — relative-time buckets on a fixed clock.
  describe('timeAgo buckets', () => {
    afterEach(() => { vi.useRealTimers() })
    const at = (now: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)) }

    it('reads a future timestamp as "just now"', () => {
      at('2026-07-02T10:00:00Z'); expect(timeAgo('2026-07-02T10:00:01Z')).toBe('just now')
    })
    it('reads <60s as "just now"', () => {
      at('2026-07-02T10:00:30Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('just now')
    })
    it('reads minutes', () => {
      at('2026-07-02T10:03:00Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('3m ago')
    })
    it('reads hours', () => {
      at('2026-07-02T12:00:00Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('2h ago')
    })
    it('reads 25h as "Yesterday"', () => {
      at('2026-07-03T11:00:00Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('Yesterday')
    })
    it('reads days and weeks', () => {
      at('2026-07-05T10:00:00Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('3d ago')
      at('2026-07-16T10:00:00Z'); expect(timeAgo('2026-07-02T10:00:00Z')).toBe('2w ago')
    })
    it('treats SQLite space format as UTC, with no local-time artifact', () => {
      at('2026-07-02T20:54:34Z'); expect(timeAgo('2026-07-02 18:54:34')).toBe('2h ago')
      at('2026-07-02T21:00:00Z'); expect(timeAgo('2026-07-02 18:54:34.123')).toBe('2h ago')
    })
    it('reads an epoch-seconds timestamp', () => {
      at('2026-07-02T12:00:00Z')
      expect(timeAgo(Math.floor(Date.UTC(2026, 6, 2, 10, 0, 0) / 1000))).toBe('2h ago')
    })
    it('renders unparseable input as "—" rather than "NaN ago"', () => {
      expect(timeAgo(null)).toBe('—')
      expect(timeAgo('not-a-date')).toBe('—')
    })
  })

  // Ported from the retired src/utils/time.test.ts.
  describe('formatTimeOfDay', () => {
    it('returns empty string for null', () => { expect(formatTimeOfDay(null)).toBe('') })
    it('renders ISO and space-format alike', () => {
      expect(formatTimeOfDay('2026-07-02T18:54:34Z')).toBeTruthy()
      expect(formatTimeOfDay('2026-07-02 18:54:34')).toBeTruthy()
    })
  })

  it.skipIf(!hasDb)('parses a real sample of every encoding in the live database', () => {
    const conn = db()
    try {
      const samples: Array<[string, string]> = [
        ['agent_runs.started_at (A)', 'SELECT started_at v FROM agent_runs WHERE started_at IS NOT NULL LIMIT 1'],
        ['hook_failures.timestamp (B)', 'SELECT timestamp v FROM hook_failures WHERE timestamp IS NOT NULL LIMIT 1'],
        ['dispatch_decisions.created_at (C)', 'SELECT created_at v FROM dispatch_decisions WHERE created_at IS NOT NULL LIMIT 1'],
        ['pane_bindings.started_at (D)', 'SELECT started_at v FROM pane_bindings WHERE started_at IS NOT NULL LIMIT 1'],
      ]
      for (const [label, sql] of samples) {
        const row = conn.prepare(sql).get() as { v: string | number } | undefined
        if (!row) continue // table legitimately empty
        const ms = toEpochMs(row.v)
        expect(ms, `${label}: ${String(row.v)}`).not.toBeNull()
        // Sanity-bound it to 2020..2040 so a seconds/ms mix-up is caught, not just NaN.
        expect(ms!, `${label}: ${String(row.v)} -> ${new Date(ms!).toISOString()}`)
          .toBeGreaterThan(Date.UTC(2020, 0, 1))
        expect(ms!).toBeLessThan(Date.UTC(2040, 0, 1))
      }
    } finally { conn.close() }
  })
})

// ── Formatting ───────────────────────────────────────────────────────────────

describe('format', () => {
  it('distinguishes "not recorded" from zero', () => {
    // agent_runs.cost_usd is NULL on running rows — that is not $0.00.
    expect(formatCost(null)).toBe('—')
    expect(formatCost(0)).toBe('$0.0000')
    expect(formatTokens(null)).toBe('—')
    expect(formatTokens(0)).toBe('0')
  })

  it('scales precision to magnitude', () => {
    expect(formatCost(4837.2)).toBe('$4837')
    expect(formatCost(12.4)).toBe('$12.40')
    expect(formatCost(0.0031)).toBe('$0.0031')
    expect(formatCost(0.0031, 2)).toBe('$0.00')
    expect(formatTokens(1_500_000)).toBe('1.5M')
    expect(formatTokens(2_400)).toBe('2K')
  })
})

// ── Schema contract ──────────────────────────────────────────────────────────

describe('castSchema', () => {
  it.skipIf(!hasDb)('declares only tables that exist in the live database', () => {
    const conn = db()
    try {
      const present = new Set(
        (conn.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
          .map(r => r.name),
      )
      const missing = Object.keys(CAST_SCHEMA).filter(t => !present.has(t))
      expect(missing).toEqual([])
    } finally { conn.close() }
  })

  it.skipIf(!hasDb)('declares only columns that exist', () => {
    // Mutation-check: add 'has_status' to agent_truncations.columns -> fails.
    const conn = db()
    try {
      const missing: string[] = []
      for (const [table, contract] of Object.entries(CAST_SCHEMA)) {
        const cols = new Set(
          (conn.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(r => r.name),
        )
        for (const c of contract.columns) if (!cols.has(c)) missing.push(`${table}.${c}`)
        if (contract.timeColumn && !cols.has(contract.timeColumn)) {
          missing.push(`${table}.${contract.timeColumn} (declared timeColumn)`)
        }
      }
      expect(missing).toEqual([])
    } finally { conn.close() }
  })

  it.skipIf(!hasDb)('confirms every retired table is still absent', () => {
    const conn = db()
    try {
      const resurrected = Object.keys(RETIRED_TABLES).filter(t =>
        conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t),
      )
      expect(resurrected).toEqual([])
    } finally { conn.close() }
  })

  it.skipIf(!hasDb)('confirms every retired column is still absent', () => {
    const conn = db()
    try {
      const resurrected: string[] = []
      for (const ref of Object.keys(RETIRED_COLUMNS)) {
        const [table, column] = ref.split('.')
        const exists = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
        if (!exists) continue
        const cols = (conn.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(r => r.name)
        if (cols.includes(column)) resurrected.push(ref)
      }
      expect(resurrected).toEqual([])
    } finally { conn.close() }
  })

  it('never marks a retired table as queryable', () => {
    for (const t of Object.keys(RETIRED_TABLES)) expect(isQueryableTable(t)).toBe(false)
    expect(isQueryableTable('agent_runs')).toBe(true)
  })

  it('carries a producer status and timestamp format for every table', () => {
    for (const [table, c] of Object.entries(CAST_SCHEMA)) {
      expect(c.columns.length, `${table} has no columns`).toBeGreaterThan(0)
      expect(['live', 'dormant', 'dead_writer_retired', 'external'], `${table}.status`).toContain(c.status)
      if (c.timeColumn) expect(['A', 'B', 'C', 'D'], `${table}.timeFormat`).toContain(c.timeFormat)
    }
  })
})

// ── Referenced Tables Exist Invariant (D4-class) ──────────────────────────────────

describe('castSchema — referenced tables in routes', () => {
  it('scans all server/routes/*.ts files and asserts every SQL table reference exists in CAST_SCHEMA', () => {
    const routesDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'server', 'routes')
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))

    const foundTables = new Set<string>()
    const cteNames = new Set<string>()

    // Match SQL queries with strict pattern: FROM/JOIN/INSERT INTO/UPDATE/DELETE FROM followed by table name
    // Only match in backtick-quoted SQL strings (template literals)
    const sqlBlockPattern = /`([^`]+)`/g
    const tableRefPattern = /\b(?:FROM|UPDATE|DELETE\s+FROM|INSERT\s+INTO|JOIN)\s+([a-z_][a-z0-9_]*)\b/gi
    const ctePattern = /WITH\s+([a-z_][a-z0-9_]*)\s+AS\s*\(/gi

    const sqlKeywords = new Set([
      'sqlite_master', 'select', 'where', 'and', 'or', 'not', 'in', 'on', 'as',
      'values', 'set', 'is', 'null', 'inner', 'left', 'right', 'cross', 'union',
      'with', 'case', 'when', 'then', 'else', 'end', 'group', 'order', 'by',
      'having', 'limit', 'offset', 'distinct', 'all',
    ])

    for (const file of files) {
      const src = fs.readFileSync(path.join(routesDir, file), 'utf-8')
      for (const sqlMatch of src.matchAll(sqlBlockPattern)) {
        const sqlText = sqlMatch[1]!

        // First, collect all CTE names in this SQL block
        for (const cteMatch of sqlText.matchAll(ctePattern)) {
          cteNames.add(cteMatch[1]!.toLowerCase())
        }

        for (const m of sqlText.matchAll(tableRefPattern)) {
          const tableName = m[1]!.toLowerCase()
          if (!sqlKeywords.has(tableName) && !cteNames.has(tableName) && !tableName.startsWith('_litestream')) {
            foundTables.add(tableName)
          }
        }
      }
    }

    // Sanity check: more than 5 tables referenced (guards against a broken regex)
    expect(foundTables.size).toBeGreaterThan(5)

    const missing: string[] = []
    for (const table of foundTables) {
      if (!isQueryableTable(table)) {
        missing.push(table)
      }
    }

    expect(missing, 'These table references are not declared in CAST_SCHEMA').toEqual([])
  })
})
