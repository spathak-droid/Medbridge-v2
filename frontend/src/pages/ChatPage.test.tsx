import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatPage } from './ChatPage'
import * as api from '../lib/api'
import type { Conversation, Goal, SendMessageResponse, StartOnboardingResponse, ChatMessage } from '../lib/types'

vi.mock('../lib/api')

const mockConversations: Conversation[] = [
  {
    id: 1,
    patient_id: 1,
    phase_at_creation: 'ACTIVE',
    started_at: '2024-01-01T10:00:00Z',
    messages: [
      { id: 1, role: 'PATIENT', content: 'Hi coach', created_at: '2024-01-01T10:00:00Z' },
      { id: 2, role: 'COACH', content: 'Hello! How are you?', created_at: '2024-01-01T10:01:00Z' },
    ],
  },
]

const mockSendResponse: SendMessageResponse = {
  conversation_id: 1,
  patient_message: { id: 3, role: 'PATIENT', content: 'Doing well', created_at: '2024-01-01T10:02:00Z' },
  coach_message: { id: 4, role: 'COACH', content: 'Great to hear!', created_at: '2024-01-01T10:02:01Z' },
}

const mockOnboardingResponse: StartOnboardingResponse = {
  conversation_id: 1,
  coach_message: {
    id: 10,
    role: 'COACH',
    content: 'Welcome! Let me help you set an exercise goal.',
    created_at: '2024-01-01T10:00:00Z',
  },
}

const mockGoals: Goal[] = [
  {
    id: 1,
    patient_id: 1,
    raw_text: 'Walk 30 minutes 3 times a week',
    confirmed: true,
    created_at: '2024-01-15T10:00:00Z',
  },
]

/**
 * Helper to mock sendMessageStream so that it immediately calls the onDone callback
 * with the coach message from mockSendResponse.
 */
function mockStreamWithImmediateDone() {
  vi.mocked(api.sendMessageStream).mockImplementation(
    async (_req, _onToken, onDone) => {
      const coachMsg: ChatMessage = mockSendResponse.coach_message
      // Call onDone synchronously to simulate a completed stream
      setTimeout(() => onDone(coachMsg), 0)
      return new AbortController()
    }
  )
}

/**
 * Helper to mock sendMessageStream so that it never resolves (stays in sending state).
 */
function mockStreamNeverResolves() {
  vi.mocked(api.sendMessageStream).mockImplementation(
    () => Promise.resolve(new AbortController())
  )
}

describe('ChatPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.getGoals).mockResolvedValue([])
  })

  it('displays conversation history on load', async () => {
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Hi coach')).toBeInTheDocument()
      expect(screen.getByText('Hello! How are you?')).toBeInTheDocument()
    })
  })

  it('shows welcome state when no conversations exist', async () => {
    vi.mocked(api.getConversations).mockResolvedValue([])

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument()
    })
  })

  it('sends a message and displays coach response', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    mockStreamWithImmediateDone()

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Hi coach')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Doing well')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText('Great to hear!')).toBeInTheDocument()
    })
  })

  it('shows typing indicator while waiting for response', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    // Never resolve the stream to keep the sending state
    mockStreamNeverResolves()

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Hi coach')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Doing well')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
  })

  it('disables input while sending', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    mockStreamNeverResolves()

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Hi coach')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement
    await user.type(input, 'Doing well')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(input).toBeDisabled()
  })

  // --- Onboarding flow tests ---

  it('shows onboarding CTA when no conversation history', async () => {
    vi.mocked(api.getConversations).mockResolvedValue([])

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /begin coaching/i })).toBeInTheDocument()
    })
  })

  it('starts onboarding when CTA is clicked and shows welcome message', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConversations).mockResolvedValue([])
    vi.mocked(api.startOnboarding).mockResolvedValue(mockOnboardingResponse)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /begin coaching/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /begin coaching/i }))

    await waitFor(() => {
      expect(screen.getByText('Welcome! Let me help you set an exercise goal.')).toBeInTheDocument()
    })
  })

  it('calls startOnboarding API when CTA is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(api.getConversations).mockResolvedValue([])
    vi.mocked(api.startOnboarding).mockResolvedValue(mockOnboardingResponse)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /begin coaching/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /begin coaching/i }))

    expect(api.startOnboarding).toHaveBeenCalledWith(1)
  })

  // --- Goal confirmation card tests ---

  it('renders goal confirmation card when message has goal_proposed metadata', async () => {
    const conversationWithGoal: Conversation[] = [
      {
        id: 1,
        patient_id: 1,
        phase_at_creation: 'ONBOARDING',
        started_at: '2024-01-01T10:00:00Z',
        messages: [
          {
            id: 5,
            role: 'COACH',
            content: 'Based on our conversation, I suggest this goal:',
            created_at: '2024-01-01T10:05:00Z',
            metadata: { goal_proposed: true, goal_text: 'Walk 30 minutes 3 times a week', goal_id: 1 },
          },
        ],
      },
    ]
    vi.mocked(api.getConversations).mockResolvedValue(conversationWithGoal)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Walk 30 minutes 3 times a week')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    })
  })

  it('shows "Goal confirmed!" after confirming goal', async () => {
    const user = userEvent.setup()
    const conversationWithGoal: Conversation[] = [
      {
        id: 1,
        patient_id: 1,
        phase_at_creation: 'ONBOARDING',
        started_at: '2024-01-01T10:00:00Z',
        messages: [
          {
            id: 5,
            role: 'COACH',
            content: 'Based on our conversation, I suggest this goal:',
            created_at: '2024-01-01T10:05:00Z',
            metadata: { goal_proposed: true, goal_text: 'Walk 30 minutes 3 times a week', goal_id: 1 },
          },
        ],
      },
    ]
    vi.mocked(api.getConversations).mockResolvedValue(conversationWithGoal)
    vi.mocked(api.confirmGoal).mockResolvedValue({
      id: 1,
      patient_id: 1,
      raw_text: 'Walk 30 minutes 3 times a week',
      confirmed: true,
      created_at: '2024-01-15T10:00:00Z',
    })

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => {
      expect(screen.getByText(/goal confirmed/i)).toBeInTheDocument()
    })
  })

  // --- Goal summary tests ---

  it('shows goal summary in header when patient has a confirmed goal', async () => {
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    vi.mocked(api.getGoals).mockResolvedValue(mockGoals)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('goal-summary')).toBeInTheDocument()
      expect(screen.getByText('Walk 30 minutes 3 times a week')).toBeInTheDocument()
    })
  })

  it('shows goal date in goal summary', async () => {
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    vi.mocked(api.getGoals).mockResolvedValue(mockGoals)

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByTestId('goal-date')).toBeInTheDocument()
    })
  })

  it('does not show goal summary when no confirmed goals exist', async () => {
    vi.mocked(api.getConversations).mockResolvedValue(mockConversations)
    vi.mocked(api.getGoals).mockResolvedValue([])

    render(<ChatPage patientId={1} />)

    await waitFor(() => {
      expect(screen.getByText('Hi coach')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('goal-summary')).not.toBeInTheDocument()
  })
})
