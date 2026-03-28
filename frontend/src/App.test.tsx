import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { PatientProvider } from './contexts/PatientContext'

const mockPatient = {
  id: 1,
  name: 'Test Patient',
  external_id: 'test-uid',
  phase: 'ACTIVE',
  consent_given: true,
  adherence_pct: null,
  goal_summary: null,
}

vi.mock('./lib/api', () => ({
  getConversations: vi.fn(() => Promise.resolve([])),
  sendMessage: vi.fn(),
  sendMessageStream: vi.fn(() => new AbortController()),
  getGoals: vi.fn(() => Promise.resolve([])),
  startOnboarding: vi.fn(),
  confirmGoal: vi.fn(),
  getConsentStatus: vi.fn(() => Promise.resolve({ consent_given: true })),
  updateConsent: vi.fn(),
  getPatients: vi.fn(() => Promise.resolve([mockPatient])),
  findOrCreatePatient: vi.fn(() => Promise.resolve(mockPatient)),
  getAlerts: vi.fn(() => Promise.resolve([])),
  getSchedule: vi.fn(() => Promise.resolve([])),
  getUnreadCount: vi.fn(() => Promise.resolve(0)),
  registerRole: vi.fn(() => Promise.resolve()),
}))

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'test-uid', email: 'test@test.com', role: 'patient', name: 'Test' },
    firebaseUser: null,
    loading: false,
    isDemo: true,
    signIn: vi.fn(),
    signUp: vi.fn(),
    demoLogin: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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

    // HealthPage renders "CareArc" in an h1 and Sidebar also has "CareArc"
    const carearcElements = await screen.findAllByText(/carearc/i)
    expect(carearcElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/ok/i)).toBeInTheDocument()
  })
})
