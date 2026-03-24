import { useEffect, useRef, useState } from 'react'
import { getDirectMessages, sendDirectMessage } from '../../lib/api'
import type { DirectMessage } from '../../lib/types'

interface Props {
  patientId: number
}

export function ClinicianMessaging({ patientId }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    getDirectMessages(patientId)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      const msg = await sendDirectMessage(patientId, input.trim())
      setMessages((prev) => [...prev, msg])
      setInput('')
    } catch {}
    setSending(false)
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-10 bg-neutral-100 rounded" />
        <div className="h-10 bg-neutral-100 rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="max-h-[400px] overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-xs text-neutral-400">No messages yet. Send one below.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isClinician = msg.sender_role === 'clinician'
          return (
            <div key={msg.id} className={`flex ${isClinician ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] rounded-xl px-3 py-2
                ${isClinician
                  ? 'bg-primary-600 text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
                }
              `}>
                <p className="text-xs leading-relaxed">{msg.content}</p>
                <p className={`text-[9px] mt-0.5 ${isClinician ? 'text-white/50' : 'text-neutral-400'}`}>
                  {new Date(msg.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                  {isClinician && msg.read_at && ' - Read'}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Send a message to this patient..."
          className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 cursor-pointer"
        >
          Send
        </button>
      </div>
    </div>
  )
}
