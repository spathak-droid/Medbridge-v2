import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { GoalSummary } from './GoalSummary'

describe('GoalSummary', () => {
  it('displays the goal text', () => {
    render(<GoalSummary goalText="Walk 30 minutes 3 times a week" dateSet="2024-01-15T10:00:00Z" />)
    expect(screen.getByText('Walk 30 minutes 3 times a week')).toBeInTheDocument()
  })

  it('displays the date the goal was set', () => {
    render(<GoalSummary goalText="Walk 30 minutes 3 times a week" dateSet="2024-01-15T10:00:00Z" />)
    expect(screen.getByTestId('goal-date')).toBeInTheDocument()
  })

  it('renders with goal summary test id', () => {
    render(<GoalSummary goalText="Walk daily" dateSet="2024-01-15T10:00:00Z" />)
    expect(screen.getByTestId('goal-summary')).toBeInTheDocument()
  })
})
