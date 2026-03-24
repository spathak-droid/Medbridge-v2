import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MessageBubble } from './MessageBubble'

describe('MessageBubble', () => {
  it('renders patient message with right alignment', () => {
    render(
      <MessageBubble
        role="PATIENT"
        content="Hello coach"
        createdAt="2024-01-01T12:00:00Z"
      />
    )
    expect(screen.getByText('Hello coach')).toBeInTheDocument()
    const container = screen.getByTestId('message-bubble')
    expect(container.className).toContain('justify-end')
  })

  it('renders coach message with left alignment', () => {
    render(
      <MessageBubble
        role="COACH"
        content="Hi! How can I help?"
        createdAt="2024-01-01T12:01:00Z"
      />
    )
    expect(screen.getByText('Hi! How can I help?')).toBeInTheDocument()
    const container = screen.getByTestId('message-bubble')
    expect(container.className).toContain('justify-start')
  })

  it('displays coach avatar for coach messages', () => {
    render(
      <MessageBubble
        role="COACH"
        content="Test"
        createdAt="2024-01-01T12:00:00Z"
      />
    )
    // The redesigned MessageBubble shows a coach avatar (SVG) instead of a text label
    const bubble = screen.getByTestId('message-bubble')
    expect(bubble.querySelector('svg')).toBeInTheDocument()
  })

  it('displays timestamp', () => {
    render(
      <MessageBubble
        role="PATIENT"
        content="Test"
        createdAt="2024-01-01T12:00:00Z"
      />
    )
    expect(screen.getByTestId('message-time')).toBeInTheDocument()
  })
})
