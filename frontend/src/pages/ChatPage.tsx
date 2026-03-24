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
  getConversations,
  getGoals,
  sendMessage,
  sendMessageStream,
  startOnboarding,
} from '../lib/api'
import type { ChatMessage, Conversation, Goal } from '../lib/types'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setLoading(true)
    setMessages([])
    setCurrentGoal(null)
    setConfirmedGoalIds(new Set())
    setGoalsMap(new Map())
    setConversations([])
    setActiveConvId(null)

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

    const controller = await sendMessageStream(
      req,
      (token) => {
        setIsStreaming(true)
        setSending(false)
        setStreamingContent((prev) => prev + token)
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
        // Update the conversation in our list
        updateConvMessages(optimisticMsg, doneMsg, content)
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
              />
              {msg.metadata?.goal_proposed &&
                msg.metadata.goal_text &&
                msg.metadata.goal_id && (
                  <GoalCard
                    goalText={msg.metadata.goal_text}
                    confirmed={confirmedGoalIds.has(msg.metadata.goal_id)}
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
            />
          )}

          {sending && !isStreaming && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={sending || isStreaming}
      />
    </div>
  )
}
