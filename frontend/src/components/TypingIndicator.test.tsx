import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TypingIndicator } from './TypingIndicator'

describe('TypingIndicator', () => {
  it('renders typing dots', () => {
    render(<TypingIndicator />)
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
  })

  it('shows typing dots', () => {
    render(<TypingIndicator />)
    // The redesigned TypingIndicator shows animated dots (no text label)
    const indicator = screen.getByTestId('typing-indicator')
    expect(indicator.querySelectorAll('span').length).toBeGreaterThanOrEqual(3)
  })
})
