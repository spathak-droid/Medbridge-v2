import type { ChatMessage } from '../../lib/types'
import { MessageBubble } from '../MessageBubble'

interface ConversationHistoryProps {
  messages: ChatMessage[]
}

export function ConversationHistory({ messages }: ConversationHistoryProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-neutral-400 text-center py-8">No conversation history</p>
    )
  }

  return (
    <div className="space-y-1">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          createdAt={msg.created_at}
        />
      ))}
    </div>
  )
}
