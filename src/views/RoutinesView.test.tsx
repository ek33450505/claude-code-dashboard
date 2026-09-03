import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactNode } from 'react'

vi.mock('../api/useRoutines', () => ({
  useRoutines: vi.fn(),
}))

import { useRoutines, type RoutineRow } from '../api/useRoutines'
import RoutinesView from './RoutinesView'

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function makeRoutine(overrides: Partial<RoutineRow>): RoutineRow {
  return {
    id: '1',
    name: 'nightly-sweep',
    trigger_type: 'cron',
    trigger_value: '0 2 * * *',
    agent_to_dispatch: 'debugger',
    enabled: 1,
    last_run_at: new Date().toISOString(),
    last_run_status: null,
    last_run_output_path: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RoutinesView', () => {
  it('renders a success pill for a successful run', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [makeRoutine({ last_run_status: 'success' })] },
      isLoading: false,
    } as ReturnType<typeof useRoutines>)

    render(<RoutinesView />, { wrapper: Wrapper })

    expect(screen.getByText('success')).toHaveClass('text-emerald-400')
  })

  it('renders a danger pill for a failed run', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [makeRoutine({ last_run_status: 'failure' })] },
      isLoading: false,
    } as ReturnType<typeof useRoutines>)

    render(<RoutinesView />, { wrapper: Wrapper })

    expect(screen.getByText('failure')).toHaveClass('text-rose-400')
  })

  // A null last_run_status must render the em-dash placeholder, never a
  // StatusPill — this branch predates the pill and must stay exact.
  it('renders an em-dash, not a pill, for a null last_run_status', () => {
    vi.mocked(useRoutines).mockReturnValue({
      data: { routines: [makeRoutine({ last_run_status: null })] },
      isLoading: false,
    } as ReturnType<typeof useRoutines>)

    render(<RoutinesView />, { wrapper: Wrapper })

    const dash = screen.getByText('—')
    expect(dash.tagName).toBe('SPAN')
    // The pill wraps its label in a border + rounded-full pill; the
    // null-status placeholder must not carry that styling.
    expect(dash).not.toHaveClass('rounded-full')
  })
})
