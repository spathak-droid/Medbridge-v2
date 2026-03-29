import type { ChatMessageMetadata } from '../lib/types'
import { SafetyNoticeCard } from './cards/SafetyNoticeCard'

interface MessageBubbleProps {
  role: 'PATIENT' | 'COACH'
  content: string
  createdAt: string
  isStreaming?: boolean
  metadata?: ChatMessageMetadata
  coachName?: string
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/^[\-\*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, '<br />')
}

function CoachAvatar({ name }: { name?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <div className="
        w-8 h-8 rounded-full
        bg-gradient-to-br from-primary-400 to-primary-600
        flex items-center justify-center
        shadow-sm
        ring-2 ring-primary-200
      ">
        <svg
          className="w-4.5 h-4.5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </div>
      <span className="text-[9px] font-bold text-primary-500">{name || 'Ari'}</span>
    </div>
  )
}

export function MessageBubble({
  role,
  content,
  createdAt,
  isStreaming = false,
  metadata,
  coachName,
}: MessageBubbleProps) {
  const isPatient = role === 'PATIENT'

  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Check if this is a safety override message
  const isSafetyMessage = metadata?.safety_classification === 'CLINICAL_CONTENT' || metadata?.safety_classification === 'CRISIS'

  if (isPatient) {
    return (
      <div
        data-testid="message-bubble"
        className="flex justify-end mb-4 animate-fade-in-up"
      >
        <div className="max-w-[80%] sm:max-w-[65%]">
          <div className="
            rounded-2xl rounded-br-md
            bg-gradient-to-br from-primary-500 to-primary-600
            px-4 py-3
            text-white text-sm leading-relaxed
            shadow-sm
          ">
            {content}
          </div>
          <div
            data-testid="message-time"
            className="text-[11px] text-neutral-400 mt-1.5 text-right"
          >
            {time}
          </div>
        </div>
      </div>
    )
  }

  // Coach message
  return (
    <>
      <div
        data-testid="message-bubble"
        className="flex justify-start mb-4 animate-fade-in-up"
      >
        <div className="flex gap-3 max-w-[85%] sm:max-w-[70%]">
          <CoachAvatar name={coachName} />
          <div className="flex-1 min-w-0">
            <div className="
              rounded-2xl rounded-tl-md
              bg-white
              border border-neutral-200/60
              border-l-[3px] border-l-primary-400
              px-4 py-3
              shadow-card
              text-sm leading-relaxed text-neutral-700
            ">
              <span
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
              {isStreaming && (
                <span className="
                  inline-block w-[2px] h-4 ml-0.5
                  bg-primary-500
                  animate-blink
                  align-text-bottom
                " />
              )}
            </div>
            <div
              data-testid="message-time"
              className="text-[11px] text-neutral-400 mt-1.5"
            >
              {isStreaming ? 'Typing...' : time}
            </div>
          </div>
        </div>
      </div>
      {isSafetyMessage && (
        <SafetyNoticeCard classification={metadata!.safety_classification as 'CLINICAL_CONTENT' | 'CRISIS'} />
      )}
    </>
  )
}
