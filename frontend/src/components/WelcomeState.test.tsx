import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { WelcomeState } from './WelcomeState'

describe('WelcomeState', () => {
  it('renders welcome message for new patients', () => {
    render(<WelcomeState onStartOnboarding={vi.fn()} />)
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
  })

  it('prompts patient to start onboarding', () => {
    render(<WelcomeState onStartOnboarding={vi.fn()} />)
    expect(screen.getByRole('button', { name: /begin coaching/i })).toBeInTheDocument()
  })

  it('renders a prominent onboarding CTA button', () => {
    render(<WelcomeState onStartOnboarding={vi.fn()} />)
    expect(screen.getByRole('button', { name: /begin coaching/i })).toBeInTheDocument()
  })

  it('calls onStartOnboarding when CTA is clicked', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()
    render(<WelcomeState onStartOnboarding={onStart} />)

    await user.click(screen.getByRole('button', { name: /begin coaching/i }))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('disables CTA button when loading is true', () => {
    render(<WelcomeState onStartOnboarding={vi.fn()} loading={true} />)
    // When loading, button text changes to "Starting..." so query by that text
    expect(screen.getByRole('button', { name: /starting/i })).toBeDisabled()
  })
})
