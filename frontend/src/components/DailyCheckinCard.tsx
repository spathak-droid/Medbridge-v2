import { useEffect, useState } from 'react'
import { submitDailyCheckin, getTodayCheckin } from '../lib/api'
import type { DailyCheckin } from '../lib/types'

const MOOD_OPTIONS = [
  { value: 1, label: 'Rough', emoji: '😣' },
  { value: 2, label: 'Meh', emoji: '😞' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 4, label: 'Good', emoji: '😊' },
  { value: 5, label: 'Great', emoji: '😄' },
]

const PAIN_RESPONSES: Record<number, string> = {
  1: "That's awesome — almost no pain!",
  2: "Looking good — keep it up!",
  3: "Not bad at all!",
  4: "Manageable — you're doing well.",
  5: "Right in the middle — let's work on bringing that down.",
  6: "I hear you. Take it easy today if you need to.",
  7: "That's a lot. Make sure to tell your care team.",
  8: "Please be gentle with yourself today.",
  9: "That sounds tough. Consider reaching out to your care team.",
  10: "I'm sorry you're hurting. Please contact your care team.",
}

const MOOD_RESPONSES: Record<number, string> = {
  1: "Hang in there — tomorrow's a new day.",
  2: "I get it. Even showing up counts.",
  3: "Steady does it. You're here and that matters.",
  4: "Love to hear it! Let's keep the momentum.",
  5: "You're radiating good vibes today!",
}

const SUBMITTED_MESSAGES = [
  "Thanks for checking in! I'll keep an eye on how you're trending.",
  "Got it! Your care team can see this too — they've got your back.",
  "Noted! Consistency with check-ins helps us help you better.",
  "All logged! Come back tomorrow and let's see how you're doing.",
]

function painColor(level: number): string {
  if (level <= 2) return '#22c55e'
  if (level <= 4) return '#84cc16'
  if (level <= 6) return '#eab308'
  if (level <= 8) return '#f97316'
  return '#ef4444'
}

interface Props {
  patientId: number
}

export function DailyCheckinCard({ patientId }: Props) {
  const [todayCheckin, setTodayCheckin] = useState<DailyCheckin | null | undefined>(undefined)
  const [painLevel, setPainLevel] = useState(5)
  const [moodLevel, setMoodLevel] = useState(3)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [submittedMsg] = useState(() => SUBMITTED_MESSAGES[Math.floor(Math.random() * SUBMITTED_MESSAGES.length)])

  useEffect(() => {
    if (!patientId) return
    getTodayCheckin(patientId)
      .then((checkin) => setTodayCheckin(checkin))
      .catch(() => setTodayCheckin(null))
  }, [patientId])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const checkin = await submitDailyCheckin(patientId, painLevel, moodLevel, notes || undefined)
      setTodayCheckin(checkin)
      setJustSubmitted(true)
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  // Loading
  if (todayCheckin === undefined) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="h-5 bg-neutral-100 rounded w-48 mb-4" />
        <div className="h-12 bg-neutral-100 rounded w-full" />
      </div>
    )
  }

  // Already checked in — Ari responds
  if (todayCheckin !== null) {
    const mood = MOOD_OPTIONS.find((m) => m.value === todayCheckin.mood_level)
    return (
      <div className="card p-6">
        {/* Ari's header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ring-2 ring-primary-200 flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-800">
              {justSubmitted ? 'Ari says...' : 'Checked in today'}
            </p>
            <p className="text-[10px] text-primary-500 font-medium">Daily Check-in</p>
          </div>
          <svg className="w-5 h-5 text-success-500 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        {/* Ari's response */}
        {justSubmitted && (
          <div className="bg-primary-50 rounded-xl p-3 mb-4 border border-primary-100">
            <p className="text-sm text-neutral-700 leading-relaxed">{submittedMsg}</p>
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest block">Pain</span>
            <span className="text-2xl font-bold" style={{ color: painColor(todayCheckin.pain_level) }}>
              {todayCheckin.pain_level}/10
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-widest block">Mood</span>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl">{mood?.emoji}</span>
              <span className="text-sm font-semibold text-neutral-600">{mood?.label}</span>
            </div>
          </div>
        </div>
        {todayCheckin.notes && (
          <p className="mt-3 text-sm text-neutral-400 italic">"{todayCheckin.notes}"</p>
        )}
      </div>
    )
  }

  // Check-in form — Ari asks
  return (
    <div className="card p-6">
      {/* Ari's greeting */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center ring-2 ring-primary-200 flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-800">Hey! Quick check-in with Ari</p>
          <p className="text-xs text-neutral-400 mt-0.5">Takes 10 seconds — helps me help you better</p>
        </div>
      </div>

      {/* Pain Level */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-600">
            How's the pain today?
          </label>
          <span className="text-lg font-bold" style={{ color: painColor(painLevel) }}>
            {painLevel}/10
          </span>
        </div>
        <div className="relative">
          <input
            type="range"
            min={1}
            max={10}
            value={painLevel}
            onChange={(e) => setPainLevel(Number(e.target.value))}
            className="w-full h-2.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)',
            }}
          />
          <div className="flex justify-between mt-1 text-[10px] text-neutral-300">
            <span>None</span>
            <span>Severe</span>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-2 italic">{PAIN_RESPONSES[painLevel]}</p>
      </div>

      {/* Mood */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-neutral-600 block mb-2">
          And your mood?
        </label>
        <div className="flex gap-2">
          {MOOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMoodLevel(option.value)}
              className={`flex-1 py-2.5 px-1 rounded-xl text-center transition-all cursor-pointer border-2 ${
                moodLevel === option.value
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-transparent bg-neutral-50 hover:bg-neutral-100'
              }`}
            >
              <span className="text-xl block">{option.emoji}</span>
              <span className={`text-[10px] font-semibold block mt-0.5 ${
                moodLevel === option.value ? 'text-primary-600' : 'text-neutral-400'
              }`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 mt-2 italic">{MOOD_RESPONSES[moodLevel]}</p>
      </div>

      {/* Notes */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-neutral-600 block mb-2">
          Anything else on your mind? <span className="text-neutral-300 font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Slept great, knee feels looser, etc..."
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-700 placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Saving...
          </>
        ) : "Let's go!"}
      </button>
    </div>
  )
}
