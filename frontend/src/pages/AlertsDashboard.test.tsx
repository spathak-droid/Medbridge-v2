import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AlertsDashboard } from './AlertsDashboard'
import * as api from '../lib/api'
import type { AlertItem } from '../lib/types'

vi.mock('../lib/api')

const mockAlerts: AlertItem[] = [
  {
    id: 1,
    patient_id: 10,
    patient_name: 'Jane Doe',
    reason: 'Mental health crisis detected',
    urgency: 'CRITICAL',
    status: 'NEW',
    created_at: '2024-01-15T10:00:00Z',
    acknowledged_at: null,
  },
  {
    id: 2,
    patient_id: 11,
    patient_name: 'John Smith',
    reason: 'Clinical content escalation',
    urgency: 'HIGH',
    status: 'NEW',
    created_at: '2024-01-15T09:00:00Z',
    acknowledged_at: null,
  },
  {
    id: 3,
    patient_id: 12,
    patient_name: 'Bob Wilson',
    reason: 'Patient disengaged after 3 unanswered attempts',
    urgency: 'NORMAL',
    status: 'ACKNOWLEDGED',
    created_at: '2024-01-14T08:00:00Z',
    acknowledged_at: '2024-01-14T12:00:00Z',
  },
]

describe('AlertsDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('displays alerts sorted by urgency', async () => {
    vi.mocked(api.getAlerts).mockResolvedValue(mockAlerts)

    render(<AlertsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    const alertCards = screen.getAllByTestId('alert-card')
    expect(alertCards).toHaveLength(3)

    // CRITICAL first
    expect(within(alertCards[0]).getByText('CRITICAL')).toBeInTheDocument()
    expect(within(alertCards[1]).getByText('HIGH')).toBeInTheDocument()
    expect(within(alertCards[2]).getByText('NORMAL')).toBeInTheDocument()
  })

  it('shows patient name, reason, urgency, status, and timestamp', async () => {
    vi.mocked(api.getAlerts).mockResolvedValue([mockAlerts[0]])

    render(<AlertsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
      expect(screen.getByText('Mental health crisis detected')).toBeInTheDocument()
      expect(screen.getByText('CRITICAL')).toBeInTheDocument()
      expect(screen.getByText('NEW')).toBeInTheDocument()
    })
  })

  it('applies urgent styling for CRISIS/CRITICAL alerts', async () => {
    vi.mocked(api.getAlerts).mockResolvedValue([mockAlerts[0]])

    render(<AlertsDashboard />)

    await waitFor(() => {
      const card = screen.getByTestId('alert-card')
      expect(card.className).toMatch(/border-l-danger/)
    })
  })

  it('shows empty state when no alerts exist', async () => {
    vi.mocked(api.getAlerts).mockResolvedValue([])

    render(<AlertsDashboard />)

    await waitFor(() => {
      expect(screen.getByText(/all clear/i)).toBeInTheDocument()
    })
  })

  it('acknowledges an alert and updates the UI', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getAlerts).mockResolvedValue([mockAlerts[0]])
    vi.mocked(api.acknowledgeAlert).mockResolvedValue({
      ...mockAlerts[0],
      status: 'ACKNOWLEDGED',
      acknowledged_at: '2024-01-15T11:00:00Z',
    })

    render(<AlertsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    })

    const ackButton = screen.getByRole('button', { name: /acknowledge/i })
    await user.click(ackButton)

    await waitFor(() => {
      expect(screen.getByText('ACKNOWLEDGED')).toBeInTheDocument()
    })
  })

  it('hides acknowledge button for already acknowledged alerts', async () => {
    vi.mocked(api.getAlerts).mockResolvedValue([mockAlerts[2]])

    render(<AlertsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument()
  })

  it('shows loading state initially', async () => {
    vi.mocked(api.getAlerts).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockAlerts), 100))
    )

    render(<AlertsDashboard />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
