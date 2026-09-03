import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ReactNode } from 'react'

vi.mock('../api/useIncidents', () => ({
  useIncidents: vi.fn(),
}))

import { useIncidents, type IncidentRow } from '../api/useIncidents'
import IncidentsView, { countByStatus } from './IncidentsView'

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function makeIncident(overrides: Partial<IncidentRow>): IncidentRow {
  return {
    id: '1',
    occurred_at: new Date().toISOString(),
    problem_summary: 'Something broke',
    fix_summary: null,
    related_files: null,
    related_commit: null,
    resolution_status: null,
    surfaced_by: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IncidentsView', () => {
  // The stat bar above the table also renders the literal words "fixed" and
  // "open" as count labels, so status-pill assertions are scoped to the
  // incidents table to avoid colliding with them.

  it('renders "fixed" for a fixed incident', () => {
    vi.mocked(useIncidents).mockReturnValue({
      data: { incidents: [makeIncident({ resolution_status: 'fixed' })] },
      isLoading: false,
    } as ReturnType<typeof useIncidents>)

    render(<IncidentsView />, { wrapper: Wrapper })

    const table = screen.getByRole('table', { name: 'Incidents' })
    expect(within(table).getByText('fixed')).toBeTruthy()
  })

  it('renders "open" for an open incident', () => {
    vi.mocked(useIncidents).mockReturnValue({
      data: { incidents: [makeIncident({ resolution_status: 'open' })] },
      isLoading: false,
    } as ReturnType<typeof useIncidents>)

    render(<IncidentsView />, { wrapper: Wrapper })

    const table = screen.getByRole('table', { name: 'Incidents' })
    expect(within(table).getByText('open')).toBeTruthy()
  })

  // Regression test for the bug where every unrecognized status rendered
  // the literal word "open" (`val === 'open' ? 'open' : 'open'`). A
  // 'wontfix' incident must display as "wontfix", never "open".
  it('renders an unrecognized status as itself, not as "open"', () => {
    vi.mocked(useIncidents).mockReturnValue({
      data: { incidents: [makeIncident({ resolution_status: 'wontfix' })] },
      isLoading: false,
    } as ReturnType<typeof useIncidents>)

    render(<IncidentsView />, { wrapper: Wrapper })

    const table = screen.getByRole('table', { name: 'Incidents' })
    expect(within(table).getByText('wontfix')).toBeTruthy()
    expect(within(table).queryByText('open')).toBeNull()
  })

  it('renders "unknown" for a null resolution_status, not "open"', () => {
    vi.mocked(useIncidents).mockReturnValue({
      data: { incidents: [makeIncident({ resolution_status: null })] },
      isLoading: false,
    } as ReturnType<typeof useIncidents>)

    render(<IncidentsView />, { wrapper: Wrapper })

    const table = screen.getByRole('table', { name: 'Incidents' })
    expect(within(table).getByText('unknown')).toBeTruthy()
    expect(within(table).queryByText('open')).toBeNull()
  })

  describe('countByStatus', () => {
    // Regression test for the stat-bar bug: every non-'fixed' status was
    // counted as 'open', so a 'wontfix' incident inflated the open count
    // even though the table correctly displayed it as "wontfix".
    it('counts a wontfix incident in "other", not "open"', () => {
      const result = countByStatus([makeIncident({ resolution_status: 'wontfix' })])
      expect(result.other).toBe(1)
      expect(result.open).toBe(0)
    })

    it('counts a null resolution_status in "other", not "open"', () => {
      const result = countByStatus([makeIncident({ resolution_status: null })])
      expect(result.other).toBe(1)
      expect(result.open).toBe(0)
    })

    it('counts an empty-string resolution_status in "other", not "open"', () => {
      const result = countByStatus([makeIncident({ resolution_status: '' })])
      expect(result.other).toBe(1)
      expect(result.open).toBe(0)
    })

    it('sums fixed + open + other to the total incident count', () => {
      const incidents = [
        makeIncident({ resolution_status: 'fixed' }),
        makeIncident({ resolution_status: 'open' }),
        makeIncident({ resolution_status: 'wontfix' }),
        makeIncident({ resolution_status: 'duplicate' }),
        makeIncident({ resolution_status: null }),
      ]
      const result = countByStatus(incidents)
      expect(result.fixed).toBe(1)
      expect(result.open).toBe(1)
      expect(result.other).toBe(3)
      expect(result.fixed + result.open + result.other).toBe(incidents.length)
    })
  })

  describe('stat bar "other" card', () => {
    it('does not render an "other" card when every incident is fixed or open', () => {
      vi.mocked(useIncidents).mockReturnValue({
        data: {
          incidents: [
            makeIncident({ id: '1', resolution_status: 'fixed' }),
            makeIncident({ id: '2', resolution_status: 'open' }),
          ],
        },
        isLoading: false,
      } as ReturnType<typeof useIncidents>)

      render(<IncidentsView />, { wrapper: Wrapper })

      expect(screen.queryByText('other')).toBeNull()
    })

    it('renders an "other" card with the correct count when a status is neither fixed nor open', () => {
      vi.mocked(useIncidents).mockReturnValue({
        data: {
          incidents: [
            makeIncident({ id: '1', resolution_status: 'fixed' }),
            makeIncident({ id: '2', resolution_status: 'wontfix' }),
          ],
        },
        isLoading: false,
      } as ReturnType<typeof useIncidents>)

      render(<IncidentsView />, { wrapper: Wrapper })

      const otherLabel = screen.getByText('other')
      expect(otherLabel).toHaveClass('text-xs')
      const card = otherLabel.closest('div') as HTMLElement
      expect(within(card).getByText('1')).toBeTruthy()
    })
  })
})
