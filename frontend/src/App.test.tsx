import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { PatientProvider } from './contexts/PatientContext'

vi.mock('./lib/api', () => ({
  getConversations: vi.fn(() => Promise.resolve([])),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(() => new AbortController()),
  getGoals: vi.fn(() => Promise.resolve([])),
  startOnboarding: vi.fn(),
  confirmGoal: vi.fn(),
  getConsentStatus: vi.fn(() => Promise.resolve({ consent_given: true })),
  updateConsent: vi.fn(),
  getPatients: vi.fn(() => Promise.resolve([])),
  getAlerts: vi.fn(() => Promise.resolve([])),
}))

function renderWithProviders(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <PatientProvider>
        <App />
      </PatientProvider>
    </MemoryRouter>
  )
}

describe('App routing', () => {
  it('renders ChatPage at root path', async () => {
    renderWithProviders(['/'])

    // ChatPage shows welcome state when no conversations
    expect(await screen.findByText(/welcome/i)).toBeInTheDocument()
  })

  it('renders HealthPage at /health path', async () => {
    renderWithProviders(['/health'])

    // HealthPage renders "MedBridge" in an h1 and Sidebar also has "MedBridge"
    const medbridgeElements = await screen.findAllByText(/medbridge/i)
    expect(medbridgeElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/ok/i)).toBeInTheDocument()
  })
})
