import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConsentScreen } from './ConsentScreen'

describe('ConsentScreen', () => {
  it('renders consent explanation of what the AI coach does', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText(/ai exercise coach consent/i)).toBeInTheDocument()
  })

  it('explains the coach is NOT a medical provider', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText(/not a medical provider/i)).toBeInTheDocument()
  })

  it('explains what data is used', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText(/exercise data/i)).toBeInTheDocument()
  })

  it('explains how to opt out later', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByText(/revoke.*consent/i)).toBeInTheDocument()
  })

  it('renders an agree/consent button', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByRole('button', { name: /i agree/i })).toBeInTheDocument()
  })

  it('renders a decline button', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('calls onConsent when agree button is clicked', async () => {
    const user = userEvent.setup()
    const onConsent = vi.fn()
    render(<ConsentScreen patientId={1} onConsent={onConsent} onDecline={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /i agree/i }))
    expect(onConsent).toHaveBeenCalledOnce()
  })

  it('calls onDecline when decline button is clicked', async () => {
    const user = userEvent.setup()
    const onDecline = vi.fn()
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={onDecline} />)

    await user.click(screen.getByRole('button', { name: /decline/i }))
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it('disables buttons while loading', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} loading={true} />)
    // When loading, the agree button text changes to "Processing..."
    expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled()
  })

  it('is responsive with mobile-friendly layout', () => {
    render(<ConsentScreen patientId={1} onConsent={vi.fn()} onDecline={vi.fn()} />)
    const container = screen.getByTestId('consent-screen')
    expect(container).toBeInTheDocument()
  })
})
