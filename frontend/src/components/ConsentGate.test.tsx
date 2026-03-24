import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsentGate } from './ConsentGate'
import * as api from '../lib/api'

vi.mock('../lib/api')

describe('ConsentGate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows loading state while fetching consent status', () => {
    vi.mocked(api.getConsentStatus).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    render(
      <ConsentGate patientId={1}>
        <div>Chat Content</div>
      </ConsentGate>
    )
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows consent screen when patient has not consented', async () => {
    vi.mocked(api.getConsentStatus).mockResolvedValue({ consent_given: false })
    render(
      <ConsentGate patientId={1}>
        <div>Chat Content</div>
      </ConsentGate>
    )

    await waitFor(() => {
      expect(screen.getByTestId('consent-screen')).toBeInTheDocument()
    })
    expect(screen.queryByText('Chat Content')).not.toBeInTheDocument()
  })

  it('renders children when patient has already consented', async () => {
    vi.mocked(api.getConsentStatus).mockResolvedValue({ consent_given: true })
    render(
      <ConsentGate patientId={1}>
        <div>Chat Content</div>
      </ConsentGate>
    )

    await waitFor(() => {
      expect(screen.getByText('Chat Content')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('consent-screen')).not.toBeInTheDocument()
  })

  it('grants consent and shows children after clicking agree', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConsentStatus).mockResolvedValue({ consent_given: false })
    vi.mocked(api.updateConsent).mockResolvedValue({
      id: 1,
      consent_given: true,
      consented_at: '2024-01-01T00:00:00Z',
    })

    render(
      <ConsentGate patientId={1}>
        <div>Chat Content</div>
      </ConsentGate>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /i agree/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /i agree/i }))

    await waitFor(() => {
      expect(screen.getByText('Chat Content')).toBeInTheDocument()
    })
    expect(api.updateConsent).toHaveBeenCalledWith(1, true)
  })

  it('calls onDecline callback when patient declines', async () => {
    const user = userEvent.setup()
    const onDecline = vi.fn()
    vi.mocked(api.getConsentStatus).mockResolvedValue({ consent_given: false })

    render(
      <ConsentGate patientId={1} onDecline={onDecline}>
        <div>Chat Content</div>
      </ConsentGate>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /decline/i }))
    expect(onDecline).toHaveBeenCalledOnce()
  })

  it('shows consent screen again after consent is revoked', async () => {
    vi.mocked(api.getConsentStatus).mockResolvedValue({ consent_given: false })
    render(
      <ConsentGate patientId={1}>
        <div>Chat Content</div>
      </ConsentGate>
    )

    await waitFor(() => {
      expect(screen.getByTestId('consent-screen')).toBeInTheDocument()
    })
    expect(screen.getByText(/ai exercise coach consent/i)).toBeInTheDocument()
  })
})
