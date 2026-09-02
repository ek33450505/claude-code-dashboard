/**
 * Clamps a user-supplied `limit`/`offset` query parameter to a safe integer range.
 *
 * Replaces four divergent inline idioms that disagreed on edge cases — most
 * importantly on negative input, where `Math.max(1, Math.min(Number(x) || d, m))`
 * yielded 1 while `Number.isFinite(x) && x > 0 ? x : d` yielded the default. This
 * helper standardizes on the default, which is the more defensible reading of a
 * nonsensical limit, and floors fractional input so the value reaching a SQL
 * LIMIT/OFFSET clause is always an integer.
 *
 * Absent, non-numeric, zero, or negative input -> `defaultValue`.
 * Fractional input -> floored. Input above `max` -> `max`.
 */
export function clampLimit(raw: unknown, defaultValue: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return defaultValue
  return Math.min(Math.floor(n), max)
}

/**
 * Clamps a user-supplied `offset`. Unlike a limit, 0 is a legitimate offset, so
 * absent/invalid/negative input floors to 0 rather than a default.
 */
export function clampOffset(raw: unknown, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(Math.floor(n), max)
}
