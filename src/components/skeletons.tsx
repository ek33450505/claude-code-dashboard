// Shared loading-skeleton primitives.
//
// These come in three structural families that CANNOT be merged into one
// component: table-row skeletons mount inside <tbody> (no wrapper element
// allowed), bar skeletons are tapering full-width bars, and card-list
// skeletons are stacked bento rows. Each family is its own component below.

interface TableSkeletonRowsProps {
  rows: number
  cols: number
  /** Per-column Tailwind width classes, e.g. ['w-32', 'w-28']. Falls back to 'w-20' for any column without an entry. */
  widths?: string[]
  cellClassName?: string
}

/** Renders `rows` <tr> elements with `cols` <td> each. No wrapper — mounts directly inside a <tbody>. */
export function TableSkeletonRows({ rows, cols, widths, cellClassName = 'px-4 py-3' }: TableSkeletonRowsProps) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-[var(--border)]">
          {[...Array(cols)].map((__, j) => {
            const isAnnouncer = i === 0 && j === 0
            return (
              <td
                key={j}
                className={cellClassName}
                {...(isAnnouncer ? { role: 'status' as const, 'aria-live': 'polite' as const } : {})}
              >
                <div className={`h-4 rounded bg-[var(--bg-secondary)] animate-pulse motion-reduce:animate-none ${widths?.[j] ?? 'w-20'}`} />
                {isAnnouncer && <span className="sr-only">Loading…</span>}
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

interface BarSkeletonProps {
  count: number
  widthStart?: number
  step?: number
  /** When provided, bars are wrapped in a <div className={className}>. When omitted, a bare fragment is rendered (the caller supplies spacing). */
  className?: string
}

/** Renders `count` tapering full-width bars: bar i is `widthStart - i * step`% wide. */
export function BarSkeleton({ count, widthStart = 95, step = 5, className }: BarSkeletonProps) {
  const bars = (
    <>
      {[...Array(count)].map((_, i) => {
        const isAnnouncer = i === 0
        return (
          <div
            key={i}
            className="h-12 rounded bg-[var(--bg-secondary)] animate-pulse motion-reduce:animate-none"
            style={{ width: `${widthStart - i * step}%` }}
            {...(isAnnouncer ? { role: 'status' as const, 'aria-live': 'polite' as const } : {})}
          >
            {isAnnouncer && <span className="sr-only">Loading…</span>}
          </div>
        )
      })}
    </>
  )
  return className ? <div className={className}>{bars}</div> : bars
}

interface CardListSkeletonProps {
  count: number
  /** When true, each row shows a leading badge placeholder alongside the two text bars. */
  badge?: boolean
  /** [base, increment] percent pairs for the two stacked bars, so each site keeps its own width math. */
  lineWidths: { line1: [number, number]; line2: [number, number] }
}

/** Renders a bento-card divided list of `count` rows, each with two stacked skeleton bars (optionally with a leading badge). */
export function CardListSkeleton({ count, badge = false, lineWidths }: CardListSkeletonProps) {
  const [base1, inc1] = lineWidths.line1
  const [base2, inc2] = lineWidths.line2

  return (
    <div className="bento-card overflow-hidden divide-y divide-[var(--glass-border)]">
      {[...Array(count)].map((_, i) => {
        const isAnnouncer = i === 0
        // Status role goes on the first row itself rather than as an extra
        // sibling: this container uses `divide-y`, which draws a border on
        // every child that has a preceding sibling — inserting a dedicated
        // announcer div would push a visible top border onto the first real
        // row, changing appearance. Attaching to the existing row avoids that.
        const announcerProps = isAnnouncer ? { role: 'status' as const, 'aria-live': 'polite' as const } : {}
        const bar1 = (
          <div
            className="h-4 rounded bg-[var(--bg-secondary)]"
            style={{ width: `${base1 + i * inc1}%` }}
          />
        )
        const bar2 = (
          <div
            className="h-3 rounded bg-[var(--bg-secondary)]"
            style={{ width: `${base2 + i * inc2}%` }}
          />
        )
        return badge ? (
          <div key={i} className="px-4 py-3 animate-pulse motion-reduce:animate-none flex items-start gap-3" {...announcerProps}>
            <div className="h-5 w-16 rounded bg-[var(--bg-secondary)]" />
            <div className="flex-1 space-y-1.5">
              {bar1}
              {bar2}
            </div>
            {isAnnouncer && <span className="sr-only">Loading…</span>}
          </div>
        ) : (
          <div key={i} className="px-4 py-3 animate-pulse motion-reduce:animate-none space-y-1.5" {...announcerProps}>
            {bar1}
            {bar2}
            {isAnnouncer && <span className="sr-only">Loading…</span>}
          </div>
        )
      })}
    </div>
  )
}
