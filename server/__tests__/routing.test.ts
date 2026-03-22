import { describe, it, expect } from 'vitest'
import { getRoutingStats } from '../parsers/routing.js'
import type { RoutingEvent } from '../../src/types/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<RoutingEvent>): RoutingEvent {
  return {
    timestamp: '2026-03-22T10:00:00Z',
    promptPreview: 'add a login page to the dashboard',
    action: 'dispatched',
    matchedRoute: 'planner',
    command: '/plan',
    pattern: '^add\\b',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getRoutingStats — totalEvents
// ---------------------------------------------------------------------------

describe('getRoutingStats — totalEvents', () => {
  it('counts only prompt events (excludes agent_dispatch and senior_dev_dispatch)', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'no_match', matchedRoute: null }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
      makeEvent({ action: 'senior_dev_dispatch', matchedRoute: 'debugger' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.totalEvents).toBe(2)
  })

  it('returns 0 when all events are agent_dispatch', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'test-writer' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.totalEvents).toBe(0)
  })

  it('returns 0 for an empty event array', () => {
    const stats = getRoutingStats([])
    expect(stats.totalEvents).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getRoutingStats — routedCount
// ---------------------------------------------------------------------------

describe('getRoutingStats — routedCount', () => {
  it('counts dispatched events with a non-opus matchedRoute', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'test-writer' }),
      makeEvent({ action: 'no_match', matchedRoute: null }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routedCount).toBe(2)
  })

  it('counts suggested events toward routedCount', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'suggested', matchedRoute: 'debugger' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routedCount).toBe(1)
  })

  it('excludes opus-matched dispatched events from routedCount', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'opus' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routedCount).toBe(1)
  })

  it('excludes no_match events from routedCount', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'no_match', matchedRoute: null }),
      makeEvent({ action: 'no_match', matchedRoute: null }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routedCount).toBe(0)
  })

  it('excludes agent_dispatch events from routedCount even when they have a matchedRoute', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routedCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getRoutingStats — autoDispatchCount
// ---------------------------------------------------------------------------

describe('getRoutingStats — autoDispatchCount', () => {
  it('counts agent_dispatch events', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'code-reviewer' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.autoDispatchCount).toBe(2)
  })

  it('counts senior_dev_dispatch events toward autoDispatchCount', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'senior_dev_dispatch', matchedRoute: 'debugger' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.autoDispatchCount).toBe(2)
  })

  it('returns 0 when no auto-dispatch events exist', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'no_match', matchedRoute: null }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.autoDispatchCount).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getRoutingStats — routingRate
// ---------------------------------------------------------------------------

describe('getRoutingStats — routingRate', () => {
  it('returns 1.0 when all substantive prompts are routed', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner', promptPreview: 'add a new login page component' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'test-writer', promptPreview: 'write tests for the auth module' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routingRate).toBe(1.0)
  })

  it('returns 0.5 when half of substantive prompts are routed', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner', promptPreview: 'add a new dashboard widget to the page' }),
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: 'what does this function actually do here' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routingRate).toBe(0.5)
  })

  it('returns 0.0 when all substantive prompts are no_match', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: 'i have a question about the codebase here' }),
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: 'please explain this part of the logic' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routingRate).toBe(0)
  })

  it('returns 0 when event array is empty', () => {
    const stats = getRoutingStats([])
    expect(stats.routingRate).toBe(0)
  })

  it('excludes slash-command prompts from the routing rate denominator', () => {
    // "/commit" is a slash command — not a keyword-routing candidate
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner', promptPreview: 'add a signup page to the app' }),
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: '/commit' }),
    ]
    const stats = getRoutingStats(events)
    // Only the "add a signup page" prompt counts; the slash command is excluded
    expect(stats.routingRate).toBe(1.0)
  })

  it('excludes very short conversational prompts from the denominator', () => {
    // "go ahead" and "ok" are ≤3 words — treated as non-routable
    const events: RoutingEvent[] = [
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: 'ok' }),
      makeEvent({ action: 'no_match', matchedRoute: null, promptPreview: 'go ahead' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner', promptPreview: 'add a new feature for exporting data' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routingRate).toBe(1.0)
  })

  it('excludes opus_escalation prompts from the routing rate denominator', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'opus_escalation', matchedRoute: 'opus', promptPreview: 'opus: redesign the entire auth system architecture' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner', promptPreview: 'add a login page to the dashboard' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.routingRate).toBe(1.0)
  })

  it('excludes agent_dispatch events entirely from the routing rate', () => {
    // agent_dispatch events represent internal plumbing, not user prompts
    const events: RoutingEvent[] = [
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit', promptPreview: '' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'code-reviewer', promptPreview: '' }),
    ]
    const stats = getRoutingStats(events)
    // No substantive prompt events → rate is 0 (not 1)
    expect(stats.routingRate).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getRoutingStats — topAgents
// ---------------------------------------------------------------------------

describe('getRoutingStats — topAgents', () => {
  it('counts dispatched events per agent', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'test-writer' }),
    ]
    const stats = getRoutingStats(events)
    const planner = stats.topAgents.find(a => a.agent === 'planner')
    const testWriter = stats.topAgents.find(a => a.agent === 'test-writer')
    expect(planner?.count).toBe(2)
    expect(testWriter?.count).toBe(1)
  })

  it('sorts topAgents descending by count', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'test-writer' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.topAgents[0].agent).toBe('planner')
    expect(stats.topAgents[0].count).toBe(3)
  })

  it('excludes opus from topAgents', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'opus' }),
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
    ]
    const stats = getRoutingStats(events)
    const opusEntry = stats.topAgents.find(a => a.agent === 'opus')
    expect(opusEntry).toBeUndefined()
  })

  it('tracks routed vs direct counts per agent', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'commit' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
    ]
    const stats = getRoutingStats(events)
    const commitAgent = stats.topAgents.find(a => a.agent === 'commit')
    expect(commitAgent?.count).toBe(3)
    expect(commitAgent?.routed).toBe(1)
    expect(commitAgent?.direct).toBe(2)
  })

  it('caps topAgents at 8 entries', () => {
    const agents = ['planner', 'debugger', 'test-writer', 'commit', 'code-reviewer', 'security', 'architect', 'refactor-cleaner', 'doc-updater']
    const events = agents.map(agent => makeEvent({ action: 'dispatched', matchedRoute: agent }))
    const stats = getRoutingStats(events)
    expect(stats.topAgents.length).toBeLessThanOrEqual(8)
  })

  it('returns empty topAgents when there are no routed events', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'no_match', matchedRoute: null }),
      makeEvent({ action: 'no_match', matchedRoute: null }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.topAgents).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getRoutingStats — recentEvents
// ---------------------------------------------------------------------------

describe('getRoutingStats — recentEvents', () => {
  it('returns up to 20 recent events (all sources)', () => {
    const events = Array.from({ length: 25 }, (_, i) =>
      makeEvent({ timestamp: `2026-03-22T${String(i).padStart(2, '0')}:00:00Z` })
    )
    const stats = getRoutingStats(events)
    expect(stats.recentEvents.length).toBe(20)
  })

  it('includes agent_dispatch events in recentEvents', () => {
    const events: RoutingEvent[] = [
      makeEvent({ action: 'dispatched', matchedRoute: 'planner' }),
      makeEvent({ action: 'agent_dispatch', matchedRoute: 'commit' }),
    ]
    const stats = getRoutingStats(events)
    expect(stats.recentEvents).toHaveLength(2)
    const actions = stats.recentEvents.map(e => e.action)
    expect(actions).toContain('agent_dispatch')
  })
})
