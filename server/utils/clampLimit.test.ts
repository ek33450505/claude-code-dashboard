import { describe, it, expect } from 'vitest'
import { clampLimit, clampOffset } from './clampLimit.js'

// C2a: the shared limit/offset clamp behind 17 route files that previously
// disagreed on edge cases — most importantly negative input (see sessions.ts
// defect test below). Pure math — no DB, no filesystem access.

describe('clampLimit', () => {
  it('returns the default for absent/undefined input', () => {
    expect(clampLimit(undefined, 50, 500)).toBe(50)
  })

  it('returns the default for a non-numeric string', () => {
    expect(clampLimit('abc', 50, 500)).toBe(50)
  })

  it('returns the default for "0"', () => {
    expect(clampLimit('0', 50, 500)).toBe(50)
  })

  it('returns the default for negative input (the deliberately unified behavior)', () => {
    expect(clampLimit('-5', 50, 500)).toBe(50)
  })

  it('floors fractional input', () => {
    expect(clampLimit('5.7', 1, 500)).toBe(5)
  })

  it('passes through in-range input', () => {
    expect(clampLimit('25', 50, 500)).toBe(25)
  })

  it('clamps input above max down to max', () => {
    expect(clampLimit('9999', 50, 500)).toBe(500)
  })

  it('accepts a numeric string', () => {
    expect(clampLimit('25', 50, 500)).toBe(25)
  })

  it('documents the sessions.ts defect class: negative limit must not reach Array.slice as a negative', () => {
    // The old expression `Number(req.query.limit) || 50` let '-5' through unchanged
    // (it's truthy), which fed `sessions.slice(0, -5)` and silently dropped the last
    // 5 sessions instead of returning 5. clampLimit forces negative input to the default.
    expect(clampLimit('-5', 50, 500)).toBe(50)
  })
})

describe('clampOffset', () => {
  it('returns 0 for absent input', () => {
    expect(clampOffset(undefined, 100_000)).toBe(0)
  })

  it('returns 0 for negative input', () => {
    expect(clampOffset('-10', 100_000)).toBe(0)
  })

  it('passes through in-range input', () => {
    expect(clampOffset('50', 100_000)).toBe(50)
  })

  it('clamps input above max down to max', () => {
    expect(clampOffset('999999', 100_000)).toBe(100_000)
  })
})
