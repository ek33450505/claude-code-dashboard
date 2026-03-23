import { Router } from 'express'
import { listSessions, loadSession } from '../parsers/sessions.js'
import { estimateCost, MODEL_RATES } from '../utils/costEstimate.js'
import type { ContentBlock } from '../../src/types/index.js'

export const analyticsRouter = Router()

analyticsRouter.get('/', (req, res) => {
  try {
    const sessions = listSessions()

    // Filter to current billing month if requested
    const currentMonthOnly = req.query.currentMonthOnly === 'true'
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const filteredSessions = currentMonthOnly
      ? sessions.filter(s => s.startedAt.startsWith(monthPrefix))
      : sessions

    // --- Totals ---
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheCreationTokens = 0
    let totalCacheReadTokens = 0
    let estimatedCostUSD = 0

    for (const s of filteredSessions) {
      totalInputTokens += s.inputTokens
      totalOutputTokens += s.outputTokens
      totalCacheCreationTokens += s.cacheCreationTokens
      totalCacheReadTokens += s.cacheReadTokens
      estimatedCostUSD += estimateCost(
        s.inputTokens,
        s.outputTokens,
        s.cacheCreationTokens,
        s.cacheReadTokens,
        s.model || ''
      )
    }

    // --- Sessions by day (last 90 days) ---
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const dayMap = new Map<string, { sessions: number; inputTokens: number; outputTokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const date = s.startedAt.slice(0, 10)
      if (date < cutoffStr) continue
      const entry = dayMap.get(date) ?? { sessions: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
      entry.sessions++
      entry.inputTokens += s.inputTokens
      entry.outputTokens += s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      dayMap.set(date, entry)
    }
    const sessionsByDay = [...dayMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // --- Sessions by project ---
    const projMap = new Map<string, { sessions: number; tokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const key = s.project
      const entry = projMap.get(key) ?? { sessions: 0, tokens: 0, cost: 0 }
      entry.sessions++
      entry.tokens += s.inputTokens + s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      projMap.set(key, entry)
    }
    const sessionsByProject = [...projMap.entries()]
      .map(([project, v]) => ({ project, ...v }))
      .sort((a, b) => b.cost - a.cost)

    // --- Model breakdown ---
    const modelMap = new Map<string, { sessions: number; tokens: number; cost: number }>()
    for (const s of filteredSessions) {
      const key = s.model || 'unknown'
      const entry = modelMap.get(key) ?? { sessions: 0, tokens: 0, cost: 0 }
      entry.sessions++
      entry.tokens += s.inputTokens + s.outputTokens
      entry.cost += estimateCost(s.inputTokens, s.outputTokens, s.cacheCreationTokens, s.cacheReadTokens, s.model || '')
      modelMap.set(key, entry)
    }
    const modelBreakdown = [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost)

    // --- Tool usage (scan most recent 50 sessions) ---
    const toolCounts = new Map<string, number>()
    const recentSessions = sessions.slice(0, 50)
    for (const s of recentSessions) {
      const entries = loadSession(s.projectEncoded, s.id)
      for (const entry of entries) {
        if (entry.message?.content && Array.isArray(entry.message.content)) {
          for (const block of entry.message.content as ContentBlock[]) {
            if (block.type === 'tool_use' && block.name) {
              toolCounts.set(block.name, (toolCounts.get(block.name) ?? 0) + 1)
            }
          }
        }
      }
    }
    const toolUsage = [...toolCounts.entries()]
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // --- Averages ---
    const sessionsWithDuration = filteredSessions.filter(s => s.durationMs !== undefined)
    const avgSessionDurationMs = sessionsWithDuration.length > 0
      ? sessionsWithDuration.reduce((sum, s) => sum + s.durationMs!, 0) / sessionsWithDuration.length
      : 0

    const avgTokensPerSession = filteredSessions.length > 0
      ? (totalInputTokens + totalOutputTokens) / filteredSessions.length
      : 0

    // --- Delegation savings ---
    // Compare actual cost (mixed models) vs hypothetical all-sonnet cost
    const SONNET_KEY = 'claude-sonnet-4-5-20250514'
    const sonnetRates = MODEL_RATES[SONNET_KEY]
    let hypotheticalSonnetCostUSD = 0
    let haikuSessions = 0
    let sonnetSessions = 0
    let opusSessions = 0

    for (const s of filteredSessions) {
      // Hypothetical: what would this session cost at sonnet rates?
      hypotheticalSonnetCostUSD += (
        s.inputTokens * sonnetRates.input +
        s.outputTokens * sonnetRates.output +
        s.cacheCreationTokens * sonnetRates.cacheWrite +
        s.cacheReadTokens * sonnetRates.cacheRead
      ) / 1_000_000

      const m = (s.model ?? '').toLowerCase()
      if (m.includes('haiku')) haikuSessions++
      else if (m.includes('opus')) opusSessions++
      else sonnetSessions++
    }

    const totalModelSessions = haikuSessions + sonnetSessions + opusSessions
    const haikuUtilizationPct = totalModelSessions > 0
      ? Math.round((haikuSessions / totalModelSessions) * 100)
      : 0
    const savedUSD = Math.max(0, hypotheticalSonnetCostUSD - estimatedCostUSD)

    const delegationSavings = {
      savedUSD,
      hypotheticalSonnetCostUSD,
      actualCostUSD: estimatedCostUSD,
      haikuUtilizationPct,
      dispatches: {
        haiku: haikuSessions,
        sonnet: sonnetSessions,
        opus: opusSessions,
      },
    }

    res.json({
      totalSessions: filteredSessions.length,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
      estimatedCostUSD,
      sessionsByDay,
      sessionsByProject,
      toolUsage,
      modelBreakdown,
      avgSessionDurationMs,
      avgTokensPerSession,
      delegationSavings,
      monthPrefix: currentMonthOnly ? monthPrefix : null,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    res.status(500).json({ error: 'Failed to compute analytics' })
  }
})
