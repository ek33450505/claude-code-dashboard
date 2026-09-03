import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Activity } from 'lucide-react'
import CompactStatCard, { CompactStatCardSkeleton } from './CompactStatCard'

function renderCard(props: Partial<React.ComponentProps<typeof CompactStatCard>> = {}) {
  return render(
    <MemoryRouter>
      <CompactStatCard icon={Activity} label="Agent Runs Today" value="42" {...props} />
    </MemoryRouter>,
  )
}

describe('CompactStatCard', () => {
  it('renders label, value, and sub when given', () => {
    renderCard({ sub: 'currently running' })
    expect(screen.getByText('Agent Runs Today')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('currently running')).toBeInTheDocument()
  })

  it('omits the sub line entirely when not given', () => {
    const { container } = renderCard()
    expect(screen.getByText('Agent Runs Today')).toBeInTheDocument()
    expect(container.querySelector('.text-\\[var\\(--text-secondary\\)\\].mt-1')).not.toBeInTheDocument()
  })

  it('wraps in a link when to is given', () => {
    renderCard({ to: '/activity' })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/activity')
  })

  it('renders no link role when to is absent', () => {
    renderCard()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('accent overrides the icon-tile background class', () => {
    const { container } = renderCard({ accent: 'bg-blue-500/10' })
    const tile = container.querySelector('.rounded-lg.shrink-0')
    expect(tile).toHaveClass('bg-blue-500/10')
    expect(tile).not.toHaveClass('bg-[var(--accent-subtle)]')
  })

  it('falls back to bg-[var(--accent-subtle)] when accent is absent', () => {
    const { container } = renderCard()
    const tile = container.querySelector('.rounded-lg.shrink-0')
    expect(tile).toHaveClass('bg-[var(--accent-subtle)]')
  })
})

describe('CompactStatCardSkeleton', () => {
  it('renders pulse placeholders instead of real content', () => {
    const { container } = render(<CompactStatCardSkeleton />)
    const pulses = container.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBe(2)
    expect(screen.queryByText('Agent Runs Today')).not.toBeInTheDocument()
  })
})
