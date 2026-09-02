/**
 * Display formatting for costs and token counts — one implementation for server and client.
 *
 * Replaces four forked `formatCost` variants (`utils/costEstimate.ts`, `SystemView.tsx`,
 * `SqliteExplorerView.tsx`, and an inline ternary in `Layout.tsx`) and two `formatTokens`.
 * They disagreed on precision, so the same figure rendered differently depending on which
 * view you were looking at.
 */

/**
 * USD, with precision chosen by magnitude so that both a $4,837 monthly total and a
 * $0.0031 single run stay readable:
 *   >= $100  ->  `$4837`
 *   >= $1    ->  `$12.40`
 *   < $1     ->  `$0.0031`
 *
 * Pass `precision` to pin the decimals instead (table columns that need to align).
 * Returns '—' for null/undefined, which is distinct from `$0.00` — a NULL cost_usd means
 * "not recorded" (running rows, oversized transcripts), not "free".
 */
export function formatCost(usd: number | null | undefined, precision?: number): string {
  if (usd === null || usd === undefined || Number.isNaN(usd)) return '—'
  if (precision !== undefined) return `$${usd.toFixed(precision)}`
  if (Math.abs(usd) >= 100) return `$${usd.toFixed(0)}`
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4)}`
}

/** Token count with K/M suffix. Returns '—' for null/undefined (not '0'). */
export function formatTokens(count: number | null | undefined): string {
  if (count === null || count === undefined || Number.isNaN(count)) return '—'
  if (Math.abs(count) >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (Math.abs(count) >= 1_000) return `${(count / 1_000).toFixed(0)}K`
  return String(count)
}

/** Integer with thousands separators. Returns '—' for null/undefined. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toLocaleString('en-US')
}

/** Percentage to one decimal, e.g. `68.4%`. Returns '—' for null/undefined. */
export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || Number.isNaN(fraction)) return '—'
  return `${(fraction * 100).toFixed(1)}%`
}
