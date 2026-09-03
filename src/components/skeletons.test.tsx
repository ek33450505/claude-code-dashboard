import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableSkeletonRows, BarSkeleton, CardListSkeleton } from './skeletons'

describe('TableSkeletonRows', () => {
  it('renders exactly `rows` rows and `cols` cells per row', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows rows={3} cols={4} />
        </tbody>
      </table>
    )
    const rows = container.querySelectorAll('tbody > tr')
    expect(rows).toHaveLength(3)
    rows.forEach(row => {
      expect(row.querySelectorAll('td')).toHaveLength(4)
    })
  })

  it('applies per-column widths in order, not a uniform width', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows rows={1} cols={3} widths={['w-32', 'w-28', 'w-24']} />
        </tbody>
      </table>
    )
    const bars = container.querySelectorAll('tbody td > div')
    expect(bars[0]).toHaveClass('w-32')
    expect(bars[1]).toHaveClass('w-28')
    expect(bars[2]).toHaveClass('w-24')
  })

  it('falls back to w-20 for columns with no width entry', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows rows={1} cols={1} />
        </tbody>
      </table>
    )
    expect(container.querySelector('tbody td > div')).toHaveClass('w-20')
  })

  it('emits no wrapper element around its rows — valid directly inside a tbody', () => {
    const { container } = render(
      <table>
        <tbody>
          <TableSkeletonRows rows={2} cols={2} />
        </tbody>
      </table>
    )
    // Every direct child of <tbody> must be a <tr> — no enclosing <div>/fragment wrapper element.
    const tbody = container.querySelector('tbody')!
    expect(Array.from(tbody.children).every(child => child.tagName === 'TR')).toBe(true)
  })

  it('announces the loading state to assistive tech without adding a wrapper', () => {
    render(
      <table>
        <tbody>
          <TableSkeletonRows rows={2} cols={2} />
        </tbody>
      </table>
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/loading/i)
  })
})

describe('BarSkeleton', () => {
  it('emits no wrapper div when className is omitted', () => {
    const { container } = render(<BarSkeleton count={2} />)
    // No wrapper means container's only children are the bar divs themselves.
    expect(container.children).toHaveLength(2)
  })

  it('wraps bars in a div when className is provided', () => {
    const { container } = render(<BarSkeleton count={2} className="space-y-2" />)
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toHaveClass('space-y-2')
    expect(container.firstElementChild?.children).toHaveLength(2)
  })

  it('computes tapering widths: first bar widthStart%, nth bar widthStart - n*step%', () => {
    const { container } = render(<BarSkeleton count={3} widthStart={95} step={5} />)
    const bars = container.querySelectorAll('div')
    expect(bars[0]).toHaveStyle({ width: '95%' })
    expect(bars[1]).toHaveStyle({ width: '90%' })
    expect(bars[2]).toHaveStyle({ width: '85%' })
  })

  it('announces the loading state without adding a wrapper when className is omitted', () => {
    const { container } = render(<BarSkeleton count={2} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/loading/i)
    // Still no wrapper: the announcement lives on the first bar itself.
    expect(container.children).toHaveLength(2)
  })

  it('announces the loading state when wrapped in a div', () => {
    render(<BarSkeleton count={2} className="space-y-2" />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/loading/i)
  })
})

describe('CardListSkeleton', () => {
  it('renders the leading badge placeholder only when badge is true', () => {
    const lineWidths = { line1: [60, 8] as [number, number], line2: [40, 5] as [number, number] }
    const { container: withBadge } = render(
      <CardListSkeleton count={1} badge lineWidths={lineWidths} />
    )
    expect(withBadge.querySelector('.h-5.w-16')).not.toBeNull()

    const { container: withoutBadge } = render(
      <CardListSkeleton count={1} lineWidths={lineWidths} />
    )
    expect(withoutBadge.querySelector('.h-5.w-16')).toBeNull()
  })

  it('renders `count` rows', () => {
    const lineWidths = { line1: [60, 8] as [number, number], line2: [40, 5] as [number, number] }
    render(<CardListSkeleton count={4} lineWidths={lineWidths} />)
    // Sanity: wrapper divides rows by the bento-card divide-y container.
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('announces the loading state via the first row, not an extra divide-y sibling', () => {
    const lineWidths = { line1: [60, 8] as [number, number], line2: [40, 5] as [number, number] }
    render(<CardListSkeleton count={2} lineWidths={lineWidths} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/loading/i)
    // Announcer must be the row itself (has animate-pulse), not a new sibling —
    // an extra child here would trigger the divide-y border on the first real row.
    expect(status).toHaveClass('animate-pulse')
  })
})
