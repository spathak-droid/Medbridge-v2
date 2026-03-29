import { useEffect, useRef, useState } from 'react'
import { usePatient } from '../hooks/usePatient'
import { getDirectMessages, sendPatientReply, markMessageRead } from '../lib/api'
import type { DirectMessage } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { useToast } from '../contexts/ToastContext'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function MessagesPage() {
  const { patientId } = usePatient()
  const { toast } = useToast()
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
      toast.success('Message sent')
    } catch {}
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  // Group messages by date for separators
  const groupedMessages: { label: string; msgs: DirectMessage[] }[] = []
  messages.forEach((msg) => {
    const label = formatDateLabel(msg.created_at)
    const last = groupedMessages[groupedMessages.length - 1]
    if (last && last.label === label) {
      last.msgs.push(msg)
    } else {
      groupedMessages.push({ label, msgs: [msg] })
    }
  })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Chat Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white flex items-center justify-between shadow-sm border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 border-2 border-white">
              CT
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-800 leading-tight">Care Team</h2>
            <p className="text-xs text-accent-500 flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 bg-accent-500 rounded-full animate-pulse" />
              Online &amp; Ready to Help
            </p>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-600">No messages yet</p>
            <p className="text-xs text-neutral-400 mt-1">Your care team will reach out here</p>
          </div>
        )}

        {groupedMessages.map((group) => (
          <div key={group.label} className="space-y-4">
            {/* Date Separator */}
            <div className="flex justify-center">
              <span className="px-4 py-1 bg-neutral-100 rounded-full text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                {group.label}
              </span>
            </div>

            {group.msgs.map((msg) => {
              const isPatient = msg.sender_role === 'patient'
              return isPatient ? (
                /* Patient message - right aligned */
                <div key={msg.id} className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white self-end">
                    You
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="bg-primary-600 text-white p-4 rounded-2xl rounded-br-sm shadow-sm text-left leading-relaxed text-sm">
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium mr-1">
                      {msg.read_at ? 'Read' : 'Sent'} • {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Care team message - left aligned */
                <div key={msg.id} className="flex gap-3 max-w-2xl">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-primary-700 self-end">
                    CT
                  </div>
                  <div className="space-y-1">
                    <div className="bg-white p-4 rounded-2xl rounded-bl-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-neutral-100 text-neutral-700 leading-relaxed text-sm">
                      {msg.content}
                      {msg.is_broadcast && (
                        <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                          <span className="text-[10px] font-semibold text-primary-600">Announcement</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-medium ml-1">
                      Care Team • {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 sm:p-6 bg-white/80 backdrop-blur-sm border-t border-neutral-100">
        <div className="max-w-3xl mx-auto flex items-end gap-3 bg-neutral-50 p-2 rounded-2xl border border-neutral-200">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply to your care team..."
            rows={1}
            className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none text-sm py-3 min-h-[44px] max-h-32 resize-none text-neutral-800 placeholder:text-neutral-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-2 mb-1 mr-1 disabled:opacity-50 cursor-pointer"
          >
            <span>Send</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[10px] text-neutral-400 mt-3 font-medium">
          Messages are encrypted and shared only with your authorized clinical staff.
        </p>
      </div>
    </div>
  )
}
