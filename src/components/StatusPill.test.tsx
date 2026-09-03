import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusPill, { toneFor } from './StatusPill'

describe('StatusPill', () => {
  it('renders the status as the default label', () => {
    render(<StatusPill status="DONE" />)
    expect(screen.getByText('DONE')).toBeInTheDocument()
  })

  it('renders an overriding label when provided', () => {
    render(<StatusPill status="running" label="Live" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.queryByText('running')).not.toBeInTheDocument()
  })

  it('shows a pulsing dot for live states', () => {
    const { container } = render(<StatusPill status="running" />)
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })

  it('does not pulse for terminal states', () => {
    const { container } = render(<StatusPill status="DONE" />)
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })

  it('maps blocked/failed statuses to the danger tone', () => {
    render(<StatusPill status="BLOCKED" />)
    expect(screen.getByText('BLOCKED')).toHaveClass('text-rose-400')
  })

  it('honors an explicit tone override', () => {
    render(<StatusPill status="anything" tone="success" label="OK" />)
    expect(screen.getByText('OK')).toHaveClass('text-emerald-400')
  })

  describe('per-tone regression guard', () => {
    it('resolves the live tone', () => {
      render(<StatusPill status="running" />)
      expect(screen.getByText('running')).toHaveClass('text-[var(--accent)]')
    })

    it('resolves the success tone', () => {
      render(<StatusPill status="done" />)
      expect(screen.getByText('done')).toHaveClass('text-emerald-400')
    })

    it('resolves the warning tone', () => {
      render(<StatusPill status="pending" />)
      expect(screen.getByText('pending')).toHaveClass('text-amber-400')
    })

    it('resolves the danger tone', () => {
      render(<StatusPill status="blocked" />)
      expect(screen.getByText('blocked')).toHaveClass('text-rose-400')
    })

    it('resolves the neutral tone for an unrecognized status', () => {
      render(<StatusPill status="mystery-status" />)
      expect(screen.getByText('mystery-status')).toHaveClass('text-[var(--text-muted)]')
    })
  })

  describe('info tone (NEEDS_CONTEXT)', () => {
    it('maps needs_context to the info tone, not neutral grey', () => {
      render(<StatusPill status="needs_context" />)
      const el = screen.getByText('needs_context')
      expect(el).toHaveClass('text-violet-400')
      expect(el).not.toHaveClass('text-[var(--text-muted)]')
    })

    it('is case-insensitive for NEEDS_CONTEXT', () => {
      render(<StatusPill status="NEEDS_CONTEXT" />)
      expect(screen.getByText('NEEDS_CONTEXT')).toHaveClass('text-violet-400')
    })
  })

  describe('toneFor (exported)', () => {
    it('is callable directly and returns the right tone for each of the six tones', () => {
      expect(toneFor('running')).toBe('live')
      expect(toneFor('done')).toBe('success')
      expect(toneFor('pending')).toBe('warning')
      expect(toneFor('blocked')).toBe('danger')
      expect(toneFor('needs_context')).toBe('info')
      expect(toneFor('mystery-status')).toBe('neutral')
    })

    it('returns neutral for an unrecognized status', () => {
      expect(toneFor('some-made-up-status')).toBe('neutral')
    })
  })
})
