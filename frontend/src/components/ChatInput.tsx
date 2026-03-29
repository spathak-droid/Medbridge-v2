import { useCallback, useEffect, useRef, useState } from 'react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled: boolean
  isSpeaking?: boolean
  onStopSpeaking?: () => void
}

const QUICK_ACTIONS = [
  { label: 'Set a reminder', icon: '⏰', prompt: 'Set a reminder for me to do my exercises tomorrow at 9am' },
  { label: 'Check my progress', icon: '📊', prompt: 'How am I doing with my exercises?' },
  { label: 'Exercise tips', icon: '💡', prompt: 'Give me tips on how to do my exercises with better form' },
  { label: 'Motivation', icon: '💪', prompt: "I'm struggling to stay motivated. Can you help?" },
]

export function ChatInput({ onSend, disabled, isSpeaking, onStopSpeaking }: ChatInputProps) {
  const [text, setText] = useState('')
  const [showActions, setShowActions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  // Close quick actions on outside click
  useEffect(() => {
    if (!showActions) return
    const handleClick = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showActions])

  const handleQuickAction = (prompt: string) => {
    setShowActions(false)
    onSend(prompt)
  }

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [text, adjustHeight])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    // Reset height after send
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="
      sticky bottom-0
      border-t border-neutral-200/60
      bg-white/80 backdrop-blur-lg
      shadow-input
      px-3 sm:px-4 py-3
    ">
      <div className="
        flex items-end gap-2
        max-w-3xl mx-auto
        relative
      ">
        {/* Quick actions menu */}
        {showActions && (
          <div
            ref={actionsRef}
            className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-lg border border-neutral-200 p-1.5 animate-fade-in z-20"
          >
            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider px-2.5 py-1.5">
              I can help with...
            </div>
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={disabled}
                className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-neutral-700 hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center gap-2.5 disabled:opacity-50"
              >
                <span className="text-base">{action.icon}</span>
                <span className="font-medium text-xs">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick actions toggle button */}
        <button
          type="button"
          onClick={() => setShowActions(!showActions)}
          disabled={disabled}
          aria-label="Quick actions"
          className={`
            flex items-center justify-center
            w-10 h-10
            rounded-xl
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed
            ${showActions
              ? 'bg-primary-100 text-primary-600'
              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700'
            }
          `}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Ari..."
          disabled={disabled}
          rows={1}
          className="
            flex-1 resize-none
            rounded-xl
            border border-neutral-300
            bg-neutral-50
            px-4 py-2.5
            text-sm text-neutral-800
            placeholder:text-neutral-400
            focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400
            disabled:opacity-50 disabled:bg-neutral-100
            transition-colors duration-200
          "
        />
        {isSpeaking ? (
          <button
            type="button"
            onClick={onStopSpeaking}
            aria-label="Stop speaking"
            className="
              flex items-center justify-center
              w-10 h-10
              rounded-xl
              bg-red-500 text-white
              shadow-sm
              transition-all duration-200
              hover:bg-red-600 hover:shadow-md
              active:scale-95
              cursor-pointer
            "
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            aria-label="Send"
            className="
              flex items-center justify-center
              w-10 h-10
              rounded-xl
              bg-primary-600 text-white
              shadow-sm
              transition-all duration-200
              hover:bg-primary-700 hover:shadow-md
              active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed
              disabled:hover:shadow-sm disabled:hover:bg-primary-600
            "
          >
            {disabled ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
