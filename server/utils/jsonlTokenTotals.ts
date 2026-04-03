/**
 * Shared JSONL token aggregation utility.
 *
 * Scans all JSONL sessions (including subagent files) and returns accurate
 * token totals including cache creation/read tokens.  Used by both the
 * analytics and token-spend routes so they always report the same numbers.
 */

import { listSessions } from '../parsers/sessions.js'
import { estimateCost } from './costEstimate.js'
import type { Session } from '../../src/types/index.js'

// Cache listSessions result for 10 seconds to avoid re-scanning on every call
let _sessionsCache: Session[] | null = null
let _sessionsCacheTs = 0
function getCachedSessions(): Session[] {
  const now = Date.now()
  if (!_sessionsCache || now - _sessionsCacheTs > 10_000) {
    _sessionsCache = listSessions()
    _sessionsCacheTs = now
  }
  return _sessionsCache
}

/** Build a map of session ID → total JSONL cost (including cache tokens) */
export function getSessionCostMap(): Map<string, number> {
  const sessions = getCachedSessions()
  const map = new Map<string, number>()
  for (const s of sessions) {
    const cost = estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
    map.set(s.id, cost)
  }
  return map
}

export interface JsonlTokenTotals {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  costUsd: number
  sessionCount: number
}

/**
 * Aggregate token totals from JSONL sessions.
 *
 * @param since  Optional ISO date string (YYYY-MM-DD). Only sessions that
 *               started on or after this date are included.
 */
export function getJsonlTokenTotals(since?: string): JsonlTokenTotals {
  const sessions = getCachedSessions()

  let inputTokens = 0
  let outputTokens = 0
  let cacheCreationTokens = 0
  let cacheReadTokens = 0
  let costUsd = 0
  let sessionCount = 0

  for (const s of sessions) {
    if (since && s.startedAt && s.startedAt.slice(0, 10) < since) continue

    inputTokens += s.inputTokens
    outputTokens += s.outputTokens
    cacheCreationTokens += s.cacheCreationTokens
    cacheReadTokens += s.cacheReadTokens
    costUsd += estimateCost(
      s.inputTokens,
      s.outputTokens,
      s.cacheCreationTokens,
      s.cacheReadTokens,
      s.model || ''
    )
    sessionCount++
  }

  return { inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, costUsd, sessionCount }
}

/**
 * Daily token/cost breakdown from JSONL sessions (replaces cast.db daily query).
 */
export function getJsonlDailyBreakdown(since?: string): Array<{ date: string; inputTokens: number; outputTokens: number; costUsd: number }> {
  const sessions = getCachedSessions()
  const dayMap = new Map<string, { inputTokens: number; outputTokens: number; costUsd: number }>()

  for (const s of sessions) {
    if (since && s.startedAt && s.startedAt.slice(0, 10) < since) continue
    const date = s.startedAt ? s.startedAt.slice(0, 10) : 'unknown'
    if (date === 'unknown') continue

    const entry = dayMap.get(date) ?? { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    entry.inputTokens += s.inputTokens
    entry.outputTokens += s.outputTokens
    entry.costUsd += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
    dayMap.set(date, entry)
  }

  return Array.from(dayMap.entries())
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
