import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { GoalConfirmationCard } from './GoalConfirmationCard'

describe('GoalConfirmationCard', () => {
  const defaultProps = {
    goalText: 'Walk 30 minutes 3 times a week',
    onConfirm: vi.fn(),
    onEdit: vi.fn(),
    confirmed: false,
  }

  it('displays the proposed goal text', () => {
    render(<GoalConfirmationCard {...defaultProps} />)
    expect(screen.getByText('Walk 30 minutes 3 times a week')).toBeInTheDocument()
  })

  it('shows confirm and edit buttons when not confirmed', () => {
    render(<GoalConfirmationCard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<GoalConfirmationCard {...defaultProps} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onEdit when edit button is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    render(<GoalConfirmationCard {...defaultProps} onEdit={onEdit} />)

    await user.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('shows "Goal confirmed!" when confirmed', () => {
    render(<GoalConfirmationCard {...defaultProps} confirmed={true} />)
    expect(screen.getByText(/goal confirmed/i)).toBeInTheDocument()
  })

  it('hides confirm and edit buttons when confirmed', () => {
    render(<GoalConfirmationCard {...defaultProps} confirmed={true} />)
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('still displays the goal text when confirmed', () => {
    render(<GoalConfirmationCard {...defaultProps} confirmed={true} />)
    expect(screen.getByText('Walk 30 minutes 3 times a week')).toBeInTheDocument()
  })
})
