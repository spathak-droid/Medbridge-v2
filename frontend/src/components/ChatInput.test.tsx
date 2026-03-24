import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatInput } from './ChatInput'

describe('ChatInput', () => {
  it('renders text input and send button', () => {
    render(<ChatInput onSend={vi.fn()} disabled={false} />)
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('calls onSend with message text when submitted', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/type a message/i)
    await user.type(input, 'Hello coach!')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(onSend).toHaveBeenCalledWith('Hello coach!')
  })

  it('clears input after sending', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={vi.fn()} disabled={false} />)

    const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement
    await user.type(input, 'Hello coach!')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(input.value).toBe('')
  })

  it('disables input and button when disabled prop is true', () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />)
    expect(screen.getByPlaceholderText(/type a message/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} disabled={false} />)

    await user.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).not.toHaveBeenCalled()
  })
})
