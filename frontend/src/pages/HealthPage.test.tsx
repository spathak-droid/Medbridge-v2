import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { HealthPage } from './HealthPage'

describe('HealthPage', () => {
  it('renders without error', () => {
    render(<HealthPage />)
    expect(screen.getByText(/medbridge/i)).toBeInTheDocument()
  })

  it('shows a status indicator', () => {
    render(<HealthPage />)
    expect(screen.getByText(/ok/i)).toBeInTheDocument()
  })

  it('displays the frontend version', () => {
    render(<HealthPage />)
    expect(screen.getByText(/0\.0\.0/)).toBeInTheDocument()
  })
})
