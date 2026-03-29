import { useEffect, useRef, useState } from 'react'
import { ChatInput } from '../components/ChatInput'
import { GoalCard } from '../components/cards/GoalCard'
import { GoalSummary } from '../components/GoalSummary'
import { MessageBubble } from '../components/MessageBubble'
import { TypingIndicator } from '../components/TypingIndicator'
import { WelcomeState } from '../components/WelcomeState'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import {
  confirmGoal,
  createNewConversation,
  getCoachMode,
  getConversations,
  getGoals,
  sendMessage,
  sendMessageStream,
  setCoachMode,
  startOnboarding,
} from '../lib/api'
import type { ChatMessage, CoachModeOption, Conversation, Goal } from '../lib/types'

interface ChatPageProps {
  patientId: number
}

export function ChatPage({ patientId }: ChatPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [onboardingLoading, setOnboardingLoading] = useState(false)
  const [confirmedGoalIds, setConfirmedGoalIds] = useState<Set<number>>(new Set())
  const [goalsMap, setGoalsMap] = useState<Map<number, Goal>>(new Map())
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showConvList, setShowConvList] = useState(false)
  const [autoRead, setAutoRead] = useState(() => localStorage.getItem('ari-auto-read') === 'true')
  const [coachMode, setCoachModeState] = useState('ari')
  const [coachOptions, setCoachOptions] = useState<CoachModeOption[]>([])
  const [showCoachPicker, setShowCoachPicker] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const toggleAutoRead = () => {
    setAutoRead((prev) => {
      const next = !prev
      localStorage.setItem('ari-auto-read', String(next))
      return next
    })
  }

  // Auto-read coach messages via TTS using a persistent <audio> element
  // Sends sentences to TTS as they stream in for minimal latency
  const autoReadRef = useRef(autoRead)
  useEffect(() => { autoReadRef.current = autoRead }, [autoRead])
  const coachVoiceRef = useRef('aura-2-athena-en')
  useEffect(() => {
    const opt = coachOptions.find((o) => o.id === coachMode)
    if (opt) coachVoiceRef.current = opt.voice
  }, [coachMode, coachOptions])
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  // Queue of prefetched audio blob promises — fetching starts immediately,
  // so the next chunk is ready by the time the current one finishes playing
  const ttsQueueRef = useRef<Array<Promise<Blob | null>>>([])
  const ttsPlayingRef = useRef(false)
  const ttsBufferRef = useRef('')

  const markDone = () => {
    ttsPlayingRef.current = false
    if (ttsQueueRef.current.length === 0) setIsSpeaking(false)
    playNext()
  }

  const playNext = () => {
    const el = ttsAudioRef.current
    if (!el || ttsPlayingRef.current || ttsQueueRef.current.length === 0) {
      if (ttsQueueRef.current.length === 0) setIsSpeaking(false)
      return
    }
    ttsPlayingRef.current = true
    setIsSpeaking(true)
    const next = ttsQueueRef.current.shift()!
    next.then((blob) => {
      if (!blob || blob.size < 100) { markDone(); return }
      const url = URL.createObjectURL(blob)
      el.onended = () => { URL.revokeObjectURL(url); markDone() }
      el.onerror = () => { URL.revokeObjectURL(url); markDone() }
      el.src = url
      el.play().catch(() => { URL.revokeObjectURL(url); markDone() })
    }).catch(() => { markDone() })
  }

  const stopTts = () => {
    ttsQueueRef.current = []
    ttsPlayingRef.current = false
    ttsBufferRef.current = ''
    setIsSpeaking(false)
    if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current.removeAttribute('src') }
  }

  // Fire TTS fetch immediately (prefetch) and queue the promise
  const enqueueTts = (text: string) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || ''
    const blobPromise = fetch(`${apiBase}/api/tts/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: coachVoiceRef.current }),
    }).then((r) => r.ok ? r.blob() : null).catch(() => null)
    ttsQueueRef.current.push(blobPromise)
    playNext()
  }

  // Called per streaming token — queues sentences as they complete
  const onTtsToken = (token: string) => {
    if (!autoReadRef.current) return
    ttsBufferRef.current += token
    // Wait for a sentence boundary (. ! ?) followed by space, and at least 40 chars
    if (ttsBufferRef.current.length < 40) return
    const m = ttsBufferRef.current.match(/^(.+[.!?])\s+(.*)$/s)
    if (m) {
      const sentence = m[1].trim()
      ttsBufferRef.current = m[2]
      if (sentence.length > 5) enqueueTts(sentence)
    }
  }

  // Flush remaining buffer when streaming ends
  const flushTtsBuffer = () => {
    if (!autoReadRef.current) return
    const rest = ttsBufferRef.current.trim()
    ttsBufferRef.current = ''
    if (rest.length > 5) enqueueTts(rest)
  }

  // For non-streaming: speak full text as one chunk
  const speakText = (text: string) => {
    if (!autoReadRef.current) return
    stopTts()
    enqueueTts(text)
  }

  useEffect(() => {
    setLoading(true)
    setMessages([])
    setCurrentGoal(null)
    setConfirmedGoalIds(new Set())
    setGoalsMap(new Map())
    setConversations([])
    setActiveConvId(null)

    getCoachMode(patientId)
      .then((res) => {
        setCoachModeState(res.current)
        setCoachOptions(res.options)
      })
      .catch(() => {})

    Promise.all([
      getConversations(patientId),
      getGoals(patientId),
    ])
      .then(([convs, goals]) => {
        setConversations(convs)

        // Select the latest conversation by default
        if (convs.length > 0) {
          const latest = convs[convs.length - 1]
          setActiveConvId(latest.id)
          setMessages(latest.messages)
        }

        const gMap = new Map<number, Goal>()
        for (const g of goals) gMap.set(g.id, g)
        setGoalsMap(gMap)

        const confirmed = goals.filter((g) => g.confirmed)
        if (confirmed.length > 0) {
          setCurrentGoal(confirmed[confirmed.length - 1])
          setConfirmedGoalIds(new Set(confirmed.map((g) => g.id)))
        }
      })
      .catch((err) => console.error('Failed to load chat data:', err))
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, streamingContent])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const switchConversation = (convId: number) => {
    const conv = conversations.find((c) => c.id === convId)
    if (conv) {
      setActiveConvId(conv.id)
      setMessages(conv.messages)
      setShowConvList(false)
    }
  }

  const handleCoachSwitch = async (modeId: string) => {
    try {
      const res = await setCoachMode(patientId, modeId)
      setCoachModeState(res.current)
      setCoachOptions(res.options)
      setShowCoachPicker(false)
    } catch (err) {
      console.error('Failed to set coach mode:', err)
    }
  }

  const activeCoach = coachOptions.find((o) => o.id === coachMode)

  const handleNewChat = async () => {
    try {
      const result = await createNewConversation(patientId)
      const newConv: Conversation = {
        id: result.conversation_id,
        patient_id: patientId,
        phase_at_creation: '',
        started_at: result.started_at,
        messages: [],
      }
      setConversations((prev) => [...prev, newConv])
      setActiveConvId(newConv.id)
      setMessages([])
      setShowConvList(false)
    } catch (err) {
      console.error('Failed to create new conversation:', err)
    }
  }

  const handleStartOnboarding = async () => {
    setOnboardingLoading(true)
    try {
      const response = await startOnboarding(patientId)
      const coachMsg = response.coach_message
      setMessages([coachMsg])
      // Update the active conversation or add the onboarding one
      setActiveConvId(response.conversation_id)
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === response.conversation_id)
        if (exists) {
          return prev.map((c) =>
            c.id === response.conversation_id
              ? { ...c, messages: [coachMsg] }
              : c,
          )
        }
        return [
          ...prev,
          {
            id: response.conversation_id,
            patient_id: patientId,
            phase_at_creation: '',
            started_at: coachMsg.created_at,
            messages: [coachMsg],
          },
        ]
      })
    } finally {
      setOnboardingLoading(false)
    }
  }

  const handleSend = async (content: string) => {
    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      role: 'PATIENT',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setSending(true)
    setStreamingContent('')
    setIsStreaming(false)

    const req = {
      patient_id: patientId,
      content,
      conversation_id: activeConvId ?? undefined,
    }

    stopTts()

    const controller = await sendMessageStream(
      req,
      (token) => {
        setIsStreaming(true)
        setSending(false)
        setStreamingContent((prev) => prev + token)
        onTtsToken(token)
      },
      (doneMsg) => {
        setIsStreaming(false)
        setStreamingContent('')
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== optimisticMsg.id)
          const patientMsg: ChatMessage = {
            id: optimisticMsg.id,
            role: 'PATIENT',
            content,
            created_at: optimisticMsg.created_at,
          }
          return [...filtered, patientMsg, doneMsg]
        })
        setSending(false)
        updateConvMessages(optimisticMsg, doneMsg, content)
        flushTtsBuffer()
      },
      (safetyMsg) => {
        setIsStreaming(false)
        setStreamingContent('')
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== optimisticMsg.id)
          const patientMsg: ChatMessage = {
            id: optimisticMsg.id,
            role: 'PATIENT',
            content,
            created_at: optimisticMsg.created_at,
          }
          return [...filtered, patientMsg, safetyMsg]
        })
        setSending(false)
        updateConvMessages(optimisticMsg, safetyMsg, content)
        speakText(safetyMsg.content)
      },
      async () => {
        try {
          const response = await sendMessage(req)
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== optimisticMsg.id),
            response.patient_message,
            response.coach_message,
          ])
          updateConvMessages(optimisticMsg, response.coach_message, content)
          speakText(response.coach_message.content)
        } finally {
          setSending(false)
          setIsStreaming(false)
          setStreamingContent('')
        }
      },
    )

    abortRef.current = controller
  }

  const updateConvMessages = (optimisticMsg: ChatMessage, coachMsg: ChatMessage, content: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeConvId) return c
        const patientMsg: ChatMessage = {
          id: optimisticMsg.id,
          role: 'PATIENT',
          content,
          created_at: optimisticMsg.created_at,
        }
        return { ...c, messages: [...c.messages, patientMsg, coachMsg] }
      }),
    )
  }

  const handleConfirmGoal = async (goalId: number, _goalText: string) => {
    try {
      const confirmed = await confirmGoal(goalId)
      setConfirmedGoalIds((prev) => new Set([...prev, goalId]))
      setCurrentGoal(confirmed)
    } catch (err) {
      console.error('Failed to confirm goal:', err)
    }
  }

  const handleEditGoal = (goalText: string) => {
    handleSend(`I'd like to adjust my goal. My original goal was: "${goalText}"`)
  }

  if (loading) {
    return (
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <LoadingSkeleton variant="chat" />
        </div>
      </div>
    )
  }

  const hasMessages = messages.length > 0
  const hasAnyConversations = conversations.length > 0

  // Generate a preview label for a conversation
  const convLabel = (conv: Conversation, idx: number) => {
    const firstPatientMsg = conv.messages.find((m) => m.role === 'PATIENT')
    if (firstPatientMsg) {
      return firstPatientMsg.content.slice(0, 40) + (firstPatientMsg.content.length > 40 ? '...' : '')
    }
    const firstMsg = conv.messages[0]
    if (firstMsg) {
      return firstMsg.content.slice(0, 40) + (firstMsg.content.length > 40 ? '...' : '')
    }
    return `Chat ${idx + 1}`
  }

  return (
    <div className="flex flex-col flex-1 bg-neutral-50 min-h-0 overflow-hidden">
      <div className="flex-shrink-0">
        {currentGoal && (
          <GoalSummary
            goalText={currentGoal.raw_text}
            dateSet={currentGoal.created_at}
            structuredGoal={currentGoal.structured_goal}
          />
        )}
      </div>

      {/* Conversation selector bar */}
      {hasAnyConversations && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-neutral-200/60 bg-white">
          <button
            onClick={() => setShowConvList(!showConvList)}
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Chats ({conversations.length})
          </button>

          <div className="flex-1" />

          {/* Coach persona picker */}
          <button
            onClick={() => setShowCoachPicker(!showCoachPicker)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            {activeCoach?.name || 'Ari'}
          </button>

          {/* Auto-read toggle */}
          <button
            onClick={toggleAutoRead}
            className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
              autoRead ? 'text-primary-600' : 'text-neutral-400 hover:text-neutral-600'
            }`}
            title={autoRead ? 'Auto-read on' : 'Auto-read off'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            {autoRead ? 'Voice on' : 'Voice'}
          </button>

          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>
      )}

      {/* Coach persona picker dropdown */}
      {showCoachPicker && (
        <div className="flex-shrink-0 border-b border-neutral-200/60 bg-white px-4 py-3 animate-fade-in">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-2">Choose your coach</p>
          <div className="flex gap-2">
            {coachOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleCoachSwitch(opt.id)}
                className={`flex-1 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                  opt.id === coachMode
                    ? 'border-primary-300 bg-primary-50 shadow-sm'
                    : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${opt.id === coachMode ? 'text-primary-700' : 'text-neutral-700'}`}>
                    {opt.name}
                  </span>
                  {opt.id === coachMode && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 leading-tight">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation list dropdown */}
      {showConvList && (
        <div className="flex-shrink-0 border-b border-neutral-200/60 bg-white px-4 py-2 space-y-1 animate-fade-in max-h-48 overflow-y-auto">
          {conversations.map((conv, i) => (
            <button
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                conv.id === activeConvId
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{convLabel(conv, i)}</span>
                <span className="text-[10px] text-neutral-400 flex-shrink-0 ml-2">
                  {conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {!hasAnyConversations && !hasMessages && (
            <WelcomeState
              onStartOnboarding={handleStartOnboarding}
              loading={onboardingLoading}
            />
          )}

          {hasAnyConversations && !hasMessages && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-neutral-700 mb-1">New conversation</p>
              <p className="text-xs text-neutral-400">Send a message to start chatting with your coach</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble
                role={msg.role}
                content={msg.content}
                createdAt={msg.created_at}
                metadata={msg.metadata}
                coachName={activeCoach?.name}
              />
              {msg.metadata?.goal_proposed &&
                msg.metadata.goal_text &&
                msg.metadata.goal_id && (
                  <GoalCard
                    goalText={msg.metadata.goal_text}
                    confirmed={confirmedGoalIds.has(msg.metadata.goal_id)}
                    clinicianApproved={goalsMap.get(msg.metadata.goal_id)?.clinician_approved}
                    clinicianRejected={goalsMap.get(msg.metadata.goal_id)?.clinician_rejected}
                    rejectionReason={goalsMap.get(msg.metadata.goal_id)?.rejection_reason}
                    structuredGoal={goalsMap.get(msg.metadata.goal_id)?.structured_goal}
                    onConfirm={() =>
                      handleConfirmGoal(
                        msg.metadata!.goal_id!,
                        msg.metadata!.goal_text!,
                      )
                    }
                    onEdit={() =>
                      handleEditGoal(msg.metadata!.goal_text!)
                    }
                  />
                )}
            </div>
          ))}

          {isStreaming && streamingContent && (
            <MessageBubble
              role="COACH"
              content={streamingContent}
              createdAt={new Date().toISOString()}
              isStreaming
              coachName={activeCoach?.name}
            />
          )}

          {sending && !isStreaming && <TypingIndicator coachName={activeCoach?.name} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={sending || isStreaming}
        isSpeaking={isSpeaking}
        onStopSpeaking={stopTts}
      />
      {/* Hidden audio element for TTS — DOM elements get better autoplay treatment */}
      <audio ref={ttsAudioRef} style={{ display: 'none' }} />
    </div>
  )
}
