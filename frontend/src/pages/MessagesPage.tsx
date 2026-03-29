import { useEffect, useRef, useState } from 'react'
import { usePatient } from '../hooks/usePatient'
import { getDirectMessages, sendPatientReply, markMessageRead } from '../lib/api'
import type { DirectMessage } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

export function MessagesPage() {
  const { patientId } = usePatient()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = () => {
    if (!patientId) return
    getDirectMessages(patientId)
      .then((msgs) => {
        setMessages(msgs)
        // Mark unread clinician messages as read
        msgs
          .filter((m) => m.sender_role === 'clinician' && !m.read_at)
          .forEach((m) => markMessageRead(m.id).catch(() => {}))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMessages()
  }, [patientId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !patientId || sending) return
    setSending(true)
    try {
      const msg = await sendPatientReply(patientId, input.trim())
      setMessages((prev) => [...prev, msg])
      setInput('')
    } catch {}
    setSending(false)
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 pb-2">
        <h2 className="text-xl font-bold text-neutral-800">Messages</h2>
        <p className="text-sm text-neutral-400">Direct messages with your care team</p>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm text-neutral-500">No messages yet</p>
            <p className="text-xs text-neutral-400 mt-1">Your care team will reach out here</p>
          </div>
        )}

        {messages.map((msg) => {
          const isPatient = msg.sender_role === 'patient'
          return (
            <div key={msg.id} className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-2.5
                ${isPatient
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md shadow-sm'
                }
              `}>
                {!isPatient && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-primary-600">Care Team</span>
                    {msg.is_broadcast && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">
                        Announcement
                      </span>
                    )}
                  </div>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isPatient ? 'text-white/60' : 'text-neutral-400'}`}>
                  {new Date(msg.created_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Reply to your care team..."
            className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
