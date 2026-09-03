import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ModelBadge from './ModelBadge'

describe('ModelBadge', () => {
  it('matches on substring within a full model id, not exact equality', () => {
    // Regression: DocsView's old local badge used `model === 'opus'` and fell
    // through to the fallback color for real ids like 'claude-opus-5'.
    render(<ModelBadge model="claude-opus-5" />)
    expect(screen.getByText('Opus')).toBeInTheDocument()
  })

  it('maps fable to its label and color', () => {
    render(<ModelBadge model="claude-fable-5" />)
    const badge = screen.getByText('Fable')
    expect(badge.className).toContain('bg-rose-500/20')
    expect(badge.className).toContain('text-rose-300')
  })

  it('maps opus to its label and color', () => {
    render(<ModelBadge model="claude-opus-5" />)
    const badge = screen.getByText('Opus')
    expect(badge.className).toContain('bg-amber-500/20')
    expect(badge.className).toContain('text-amber-300')
  })

  it('maps haiku to its label and color', () => {
    render(<ModelBadge model="claude-haiku-4-5" />)
    const badge = screen.getByText('Haiku')
    expect(badge.className).toContain('bg-sky-500/20')
    expect(badge.className).toContain('text-sky-300')
  })

  it('maps sonnet to its label and color', () => {
    render(<ModelBadge model="claude-sonnet-5" />)
    const badge = screen.getByText('Sonnet')
    expect(badge.className).toContain('bg-violet-500/20')
    expect(badge.className).toContain('text-violet-300')
  })

  it('renders an em-dash, not a pill, when model is undefined', () => {
    render(<ModelBadge model={undefined} />)
    const dash = screen.getByText('—')
    expect(dash).toBeInTheDocument()
    // Not a pill: no rounded-full pill chrome on the em-dash element.
    expect(dash.className).not.toContain('rounded-full')
  })

  it('renders the raw input with fallback classes for an unrecognized model', () => {
    render(<ModelBadge model="gpt-4" />)
    const badge = screen.getByText('gpt-4')
    expect(badge.className).toContain('bg-[var(--bg-secondary)]')
    expect(badge.className).toContain('text-[var(--text-muted)]')
  })

  it('applies compact chrome (border + 10px text) for variant="compact"', () => {
    render(<ModelBadge model="claude-opus-5" variant="compact" />)
    const badge = screen.getByText('Opus')
    // Word-boundary checks, not substring: `toContain('border')` would also match
    // the tone class `border-amber-500/20` even if the standalone `border` width
    // utility were removed (proven by mutation — see skeletons.tsx a11y unit).
    expect(badge).toHaveClass('border')
    expect(badge).toHaveClass('border-amber-500/20')
    expect(badge.className).toContain('text-[10px]')
  })

  it('does not apply compact chrome for variant="default"', () => {
    render(<ModelBadge model="claude-opus-5" variant="default" />)
    const badge = screen.getByText('Opus')
    expect(badge.className).not.toContain('text-[10px]')
    expect(badge.className).toContain('text-xs')
  })
})
