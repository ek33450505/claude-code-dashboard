import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getNodeRadius,
  getNodeColor,
  getEdgeOpacity,
  getEdgeStrokeWidth,
  getTaskStatusColor,
  getGlowIntensity,
  deriveAgentStatus,
  getTaskSatelliteRadius,
  type AgentNode,
  type TaskStatus,
} from './constellationLayout'

describe('constellationLayout — pure functions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'))
  })

  describe('getNodeRadius', () => {
    const baseNode: AgentNode = {
      id: 'test-1',
      name: 'test-agent',
      model: 'sonnet',
      status: 'idle',
      recentRunCount: 0,
      lastActiveAt: null,
      totalTokens: 0,
    }

    it('returns 20px (base) for dormant status', () => {
      const result = getNodeRadius({ ...baseNode, status: 'dormant' })
      expect(result).toBe(20)
    })

    it('returns 20px (base) when recentRunCount is 0', () => {
      const result = getNodeRadius({ ...baseNode, recentRunCount: 0, status: 'active' })
      expect(result).toBe(20)
    })

    it('scales radius logarithmically for run counts 1–20+', () => {
      const r1 = getNodeRadius({ ...baseNode, recentRunCount: 1, status: 'active' })
      const r5 = getNodeRadius({ ...baseNode, recentRunCount: 5, status: 'active' })
      const r20 = getNodeRadius({ ...baseNode, recentRunCount: 20, status: 'active' })

      expect(r1).toBeGreaterThan(20)
      expect(r5).toBeGreaterThan(r1)
      expect(r20).toBeGreaterThan(r5)
      expect(r20).toBeLessThanOrEqual(60)
    })

    it('grows logarithmically for high run counts beyond 20', () => {
      const r100 = getNodeRadius({ ...baseNode, recentRunCount: 100, status: 'active' })
      const r1000 = getNodeRadius({ ...baseNode, recentRunCount: 1000, status: 'active' })
      // Beyond 20, log2(100+1)/log2(21) > 1, so it exceeds 60
      expect(r100).toBeGreaterThan(60)
      expect(r1000).toBeGreaterThan(r100)
    })

    it('respects the base at 20px minimum', () => {
      const r0 = getNodeRadius({ ...baseNode, recentRunCount: 0, status: 'active' })
      expect(r0).toBeGreaterThanOrEqual(20)
    })
  })

  describe('getNodeColor', () => {
    it('returns cyan for sonnet', () => {
      expect(getNodeColor('sonnet')).toBe('#22d3ee')
    })

    it('returns teal for haiku', () => {
      expect(getNodeColor('haiku')).toBe('#2dd4bf')
    })

    it('returns violet for opus', () => {
      expect(getNodeColor('opus')).toBe('#a78bfa')
    })

    it('returns cyan as default for unknown model', () => {
      expect(getNodeColor('unknown-model')).toBe('#22d3ee')
    })

    it('returns cyan for empty string', () => {
      expect(getNodeColor('')).toBe('#22d3ee')
    })
  })

  describe('deriveAgentStatus', () => {
    it('returns dormant when lastActiveAt is null', () => {
      const status = deriveAgentStatus('running', null, 5)
      expect(status).toBe('dormant')
    })

    it('returns active when running status and age < 30s', () => {
      const recentTime = new Date(Date.now() - 10_000).toISOString()
      const status = deriveAgentStatus('running', recentTime, 5)
      expect(status).toBe('active')
    })

    it('returns active when in_progress status and age < 30s', () => {
      const recentTime = new Date(Date.now() - 15_000).toISOString()
      const status = deriveAgentStatus('in_progress', recentTime, 5)
      expect(status).toBe('active')
    })

    it('returns recent when age < 5 minutes', () => {
      const recentTime = new Date(Date.now() - 2 * 60_000).toISOString()
      const status = deriveAgentStatus('completed', recentTime, 5)
      expect(status).toBe('recent')
    })

    it('returns idle when age < 24 hours and recentRunCount > 0', () => {
      const oldTime = new Date(Date.now() - 6 * 60_000).toISOString()
      const status = deriveAgentStatus('completed', oldTime, 3)
      expect(status).toBe('idle')
    })

    it('returns dormant when age >= 24 hours even with recentRunCount', () => {
      const veryOldTime = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
      const status = deriveAgentStatus('completed', veryOldTime, 5)
      expect(status).toBe('dormant')
    })

    it('returns dormant when age < 24h but recentRunCount is 0', () => {
      const oldTime = new Date(Date.now() - 6 * 60_000).toISOString()
      const status = deriveAgentStatus('completed', oldTime, 0)
      expect(status).toBe('dormant')
    })

    it('returns recent when dbStatus is null and age < 5min', () => {
      const oldTime = new Date(Date.now() - 40_000).toISOString()
      const status = deriveAgentStatus(null, oldTime, 0)
      // 40s is < 5 min, so returns 'recent'
      expect(status).toBe('recent')
    })
  })

  describe('getEdgeOpacity', () => {
    it('returns 0.9 for edges used within 60 seconds', () => {
      const recent = new Date(Date.now() - 30_000).toISOString()
      const opacity = getEdgeOpacity(recent)
      expect(opacity).toBe(0.9)
    })

    it('returns 0.55 for edges used 60s–1h ago', () => {
      const oneMinuteAgo = new Date(Date.now() - 90_000).toISOString()
      const opacity = getEdgeOpacity(oneMinuteAgo)
      expect(opacity).toBe(0.55)
    })

    it('returns 0.20 for edges used 1h–24h ago', () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60_000).toISOString()
      const opacity = getEdgeOpacity(sixHoursAgo)
      expect(opacity).toBe(0.20)
    })

    it('returns 0.05 for edges unused for 24h+', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60_000).toISOString()
      const opacity = getEdgeOpacity(twoWeeksAgo)
      expect(opacity).toBe(0.05)
    })
  })

  describe('getEdgeStrokeWidth', () => {
    it('returns 1 for dispatchCount <= 0', () => {
      expect(getEdgeStrokeWidth(0)).toBe(1)
      expect(getEdgeStrokeWidth(-5)).toBe(1)
    })

    it('scales logarithmically for positive counts', () => {
      const w1 = getEdgeStrokeWidth(1)
      const w2 = getEdgeStrokeWidth(2)
      const w8 = getEdgeStrokeWidth(8)

      expect(w1).toBeGreaterThanOrEqual(1)
      expect(w2).toBeGreaterThan(w1)
      expect(w8).toBeGreaterThan(w2)
    })

    it('caps stroke width at 4', () => {
      const w100 = getEdgeStrokeWidth(100)
      expect(w100).toBeLessThanOrEqual(4)
    })

    it('returns valid bounds [1, 4] for all positive inputs', () => {
      for (const count of [0, 1, 5, 10, 50, 1000]) {
        const width = getEdgeStrokeWidth(count)
        expect(width).toBeGreaterThanOrEqual(1)
        expect(width).toBeLessThanOrEqual(4)
      }
    })
  })

  describe('getTaskStatusColor', () => {
    const parentColor = '#22d3ee'

    it('returns transparent fill for pending status', () => {
      const color = getTaskStatusColor('pending', parentColor)
      expect(color.fill).toBe('transparent')
      expect(color.fillOpacity).toBe(0)
      expect(color.stroke).toMatch(/rgba/)
    })

    it('returns filled parent color for active status', () => {
      const color = getTaskStatusColor('active', parentColor)
      expect(color.fill).toBe(parentColor)
      expect(color.stroke).toBe(parentColor)
      expect(color.fillOpacity).toBe(1)
    })

    it('returns filled parent color for running status', () => {
      const color = getTaskStatusColor('running', parentColor)
      expect(color.fill).toBe(parentColor)
      expect(color.stroke).toBe(parentColor)
      expect(color.fillOpacity).toBe(1)
    })

    it('returns green for done status', () => {
      const color = getTaskStatusColor('done', parentColor)
      expect(color.fill).toBe('#4ade80')
      expect(color.stroke).toBe('#4ade80')
      expect(color.fillOpacity).toBe(1)
    })

    it('returns green for DONE status', () => {
      const color = getTaskStatusColor('DONE', parentColor)
      expect(color.fill).toBe('#4ade80')
      expect(color.stroke).toBe('#4ade80')
    })

    it('returns green for DONE_WITH_CONCERNS status', () => {
      const color = getTaskStatusColor('DONE_WITH_CONCERNS', parentColor)
      expect(color.fill).toBe('#4ade80')
      expect(color.stroke).toBe('#4ade80')
    })

    it('returns red for failed status', () => {
      const color = getTaskStatusColor('failed', parentColor)
      expect(color.fill).toBe('#f87171')
      expect(color.stroke).toBe('#f87171')
      expect(color.fillOpacity).toBe(1)
    })

    it('returns red for BLOCKED status', () => {
      const color = getTaskStatusColor('BLOCKED', parentColor)
      expect(color.fill).toBe('#f87171')
      expect(color.stroke).toBe('#f87171')
    })

    it('returns red for NEEDS_CONTEXT status', () => {
      const color = getTaskStatusColor('NEEDS_CONTEXT', parentColor)
      expect(color.fill).toBe('#f87171')
      expect(color.stroke).toBe('#f87171')
    })

    it('returns semi-transparent parent color for unknown status', () => {
      const color = getTaskStatusColor('unknown', parentColor)
      expect(color.fill).toBe(parentColor)
      expect(color.stroke).toBe(parentColor)
      expect(color.fillOpacity).toBe(0.6)
    })
  })

  describe('getGlowIntensity', () => {
    const testColor = '#22d3ee'

    it('returns bright double-shadow for active status', () => {
      const glow = getGlowIntensity('active', testColor)
      expect(glow).toContain('drop-shadow(0 0 12px')
      expect(glow).toContain('drop-shadow(0 0 24px')
      expect(glow).toContain(testColor)
    })

    it('returns single dim shadow for recent status', () => {
      const glow = getGlowIntensity('recent', testColor)
      expect(glow).toContain('drop-shadow(0 0 6px')
      expect(glow).toContain('80')
    })

    it('returns none for idle status', () => {
      const glow = getGlowIntensity('idle', testColor)
      expect(glow).toBe('none')
    })

    it('returns none for dormant status', () => {
      const glow = getGlowIntensity('dormant', testColor)
      expect(glow).toBe('none')
    })

    it('returns none for unknown status', () => {
      const glow = getGlowIntensity('unknown' as any, testColor)
      expect(glow).toBe('none')
    })

    it('varies glow based on input color', () => {
      const glowCyan = getGlowIntensity('active', '#22d3ee')
      const glowViolet = getGlowIntensity('active', '#a78bfa')
      expect(glowCyan).not.toBe(glowViolet)
      expect(glowCyan).toContain('#22d3ee')
      expect(glowViolet).toContain('#a78bfa')
    })
  })

  describe('getTaskSatelliteRadius', () => {
    it('returns 12 for active status', () => {
      expect(getTaskSatelliteRadius('active')).toBe(12)
    })

    it('returns 12 for running status', () => {
      expect(getTaskSatelliteRadius('running')).toBe(12)
    })

    it('returns 8 for done status', () => {
      expect(getTaskSatelliteRadius('done')).toBe(8)
    })

    it('returns 8 for failed status', () => {
      expect(getTaskSatelliteRadius('failed')).toBe(8)
    })

    it('returns 8 for pending status', () => {
      expect(getTaskSatelliteRadius('pending')).toBe(8)
    })

    it('returns 8 for unknown status', () => {
      expect(getTaskSatelliteRadius('unknown' as any)).toBe(8)
    })
  })
})
