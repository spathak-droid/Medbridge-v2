import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPatients, getDirectMessages, sendDirectMessage, getUnreadCount } from '../lib/api'
import type { PatientSummary, DirectMessage } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

export function ClinicianMessagesPage() {
  const { user } = useAuth()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [msgError, setMsgError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchPatients = () => {
    setError(null)
    setLoading(true)
    getPatients(true, user?.uid)
      .then(async (p) => {
        setPatients(p)
        // Fetch unread counts
        const counts: Record<number, number> = {}
        await Promise.all(
          p.map(async (pat) => {
            try {
              const { count } = await getUnreadCount(pat.id)
              counts[pat.id] = count
            } catch {
              counts[pat.id] = 0
            }
          })
        )
        setUnreadCounts(counts)
      })
      .catch((err) => setError(err.message || 'Failed to load patients'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPatients()
  }, [user?.uid])

  const fetchMessages = (patientId: number) => {
    setMsgError(null)
    setMsgLoading(true)
    getDirectMessages(patientId)
      .then(setMessages)
      .catch((err) => setMsgError(err.message || 'Failed to load messages'))
      .finally(() => setMsgLoading(false))
  }

  useEffect(() => {
    if (!selectedPatient) return
    fetchMessages(selectedPatient.id)
  }, [selectedPatient?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !selectedPatient || sending) return
    setSending(true)
    try {
      const msg = await sendDirectMessage(selectedPatient.id, input.trim())
      setMessages((prev) => [...prev, msg])
      setInput('')
    } catch {}
    setSending(false)
  }

  const filteredPatients = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPatients}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-neutral-200">
        <h2 className="text-xl font-bold text-neutral-800">Messages</h2>
        <p className="text-sm text-neutral-400">Direct messages with your patients</p>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Patient list sidebar */}
        <div className={`
          ${selectedPatient ? 'hidden md:flex' : 'flex'}
          w-full md:w-72 border-r border-neutral-200 flex-col bg-white
        `}>
          <div className="p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3
                  text-left transition-colors cursor-pointer
                  ${selectedPatient?.id === p.id
                    ? 'bg-primary-50 border-r-2 border-r-primary-500'
                    : 'hover:bg-neutral-50'
                  }
                `}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {p.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{p.name}</p>
                  <p className="text-[11px] text-neutral-400 truncate">{p.external_id}</p>
                </div>
                {(unreadCounts[p.id] ?? 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-bold min-w-[18px] text-center">
                    {unreadCounts[p.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className={`
          ${selectedPatient ? 'flex' : 'hidden md:flex'}
          flex-1 flex-col
        `}>
          {!selectedPatient ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="text-sm text-neutral-500">Select a patient to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-neutral-200 bg-white flex items-center gap-3">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="md:hidden p-1 -ml-1 text-neutral-500 hover:text-neutral-700 cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
                  {selectedPatient.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{selectedPatient.name}</p>
                  <p className="text-[11px] text-neutral-400">{selectedPatient.external_id}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {msgError ? (
                  <div className="text-center py-12">
                    <p className="text-red-600 mb-4">{msgError}</p>
                    <button
                      onClick={() => fetchMessages(selectedPatient.id)}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : msgLoading ? (
                  <LoadingSkeleton variant="card" count={2} />
                ) : messages.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-neutral-400">No messages yet. Start the conversation.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClinician = msg.sender_role === 'clinician'
                    return (
                      <div key={msg.id} className={`flex ${isClinician ? 'justify-end' : 'justify-start'}`}>
                        <div className={`
                          max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5
                          ${isClinician
                            ? 'bg-primary-600 text-white rounded-br-md'
                            : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-md shadow-sm'
                          }
                        `}>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          <div className={`flex items-center gap-1.5 mt-1 ${isClinician ? 'justify-end' : ''}`}>
                            <p className={`text-[10px] ${isClinician ? 'text-white/60' : 'text-neutral-400'}`}>
                              {new Date(msg.created_at).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </p>
                            {isClinician && msg.read_at && (
                              <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-neutral-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
