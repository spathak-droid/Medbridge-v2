import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { usePatient } from '../hooks/usePatient'
import { getAdherence, getCheckins, getGoals, getProgram, getSchedule } from '../lib/api'
import type { AdherenceSummary, DailyCheckin, Goal, ProgramSummary, ScheduleEventItem } from '../lib/types'
import { adherenceBgColor, phaseLabel } from '../lib/utils'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { ProgressStepper } from '../components/ui/ProgressStepper'
import { TrendChart } from '../components/ui/TrendChart'

const PHASE_ORDER = ['PENDING', 'ONBOARDING', 'ACTIVE', 'RE_ENGAGING', 'DORMANT']
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?/]+)/)
  return match ? match[1] : ''
}

export function ProgressPage() {
  const { patientId, patient } = usePatient()
  const navigate = useNavigate()
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEventItem[]>([])
  const [checkins, setCheckins] = useState<DailyCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    Promise.all([
      getAdherence(patientId),
      getGoals(patientId),
      getProgram(patientId).catch(() => null),
      getSchedule(patientId).catch(() => []),
      getCheckins(patientId).catch(() => []),
    ])
      .then(([adh, g, prog, sched, chk]) => {
        setAdherence(adh)
        setGoals(g)
        setProgram(prog)
        setSchedule(sched)
        setCheckins(chk)
      })
      .catch((err) => setError(err.message || 'Failed to load progress'))
      .finally(() => setLoading(false))
  }, [patientId])

  // GSAP refs — must be called before any conditional return
  const pageRef = useRef<HTMLDivElement>(null)
  const adherenceCountRef = useRef<HTMLSpanElement>(null)
  const streakCountRef = useRef<HTMLSpanElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading || !adherence || !pageRef.current) return
    const sections = pageRef.current.querySelectorAll(':scope > *')
    gsap.fromTo(sections, { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out',
    })
    // Count up adherence
    if (adherenceCountRef.current) {
      const obj = { val: 0 }
      const el = adherenceCountRef.current
      gsap.to(obj, {
        val: adherence.adherence_percentage, duration: 1.2, delay: 0.3, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.val).toString() },
      })
    }
    // Count up streak
    if (streakCountRef.current) {
      const obj = { val: 0 }
      const el = streakCountRef.current
      gsap.to(obj, {
        val: adherence.current_streak, duration: 1, delay: 0.4, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.val).toString() },
      })
    }
    // Calendar pop-in
    if (calendarRef.current) {
      const cells = calendarRef.current.querySelectorAll('[data-cal-cell]')
      gsap.fromTo(cells, { scale: 0, opacity: 0 }, {
        scale: 1, opacity: 1, duration: 0.3, stagger: 0.02, delay: 0.6, ease: 'back.out(1.7)',
      })
    }
  }, [loading, adherence])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-neutral-700 mb-1">Something went wrong</h2>
          <p className="text-sm text-neutral-400">{error}</p>
        </div>
      </div>
    )
  }

  const currentPhase = patient?.phase ?? 'PENDING'
  const phaseIndex = PHASE_ORDER.indexOf(currentPhase)
  const steps = [
    { label: 'Consent', status: phaseIndex > 0 ? 'completed' as const : 'active' as const },
    { label: 'Onboarding', status: phaseIndex > 1 ? 'completed' as const : phaseIndex === 1 ? 'active' as const : 'upcoming' as const },
    { label: 'Active Phase', status: phaseIndex >= 2 ? (currentPhase === 'ACTIVE' ? 'active' as const : 'completed' as const) : 'upcoming' as const },
    { label: 'Maintenance', status: currentPhase === 'RE_ENGAGING' || currentPhase === 'DORMANT' ? 'active' as const : 'upcoming' as const },
  ]

  const confirmedGoal = goals.find((g) => g.confirmed)

  const exerciseStats = adherence?.per_exercise
    ? Object.entries(adherence.per_exercise).map(([id, stats]) => {
        const exercise = program?.exercises.find((e) => e.id === id)
        return { id, name: exercise?.name || id, videoUrl: exercise?.video_url, ...stats }
      })
    : []

  // Estimated recovery date
  const estRecovery = program
    ? new Date(new Date(program.start_date).getTime() + program.duration_weeks * 7 * 24 * 60 * 60 * 1000)
    : null

  if (!adherence) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full animate-fade-in">
        <div className="card p-10 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Your Journey Starts Here</h3>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed max-w-sm mx-auto">
            Once you begin your exercise program, this page will track your recovery journey.
          </p>
          <button onClick={() => navigate('/program')} className="btn-primary px-6 py-3 text-sm">
            View Your Program
          </button>
        </div>
      </div>
    )
  }

  // Build activity calendar for current month
  const now = new Date()
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7 // Mon=0
  const logMap = new Map(adherence.daily_log.map(d => [d.date, d]))

  const calendarDays: { date: number; dateStr: string; completed: boolean; missed: boolean; isToday: boolean; isEmpty: boolean }[] = []
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push({ date: 0, dateStr: '', completed: false, missed: false, isToday: false, isEmpty: true })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const entry = logMap.get(dateStr)
    const isPast = new Date(dateStr) < new Date(new Date().toISOString().split('T')[0])
    calendarDays.push({
      date: d,
      dateStr,
      completed: entry?.completed ?? false,
      missed: isPast && !entry?.completed && d <= now.getDate(),
      isToday: d === now.getDate(),
      isEmpty: false,
    })
  }

  return (
    <div ref={pageRef} className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">
            Recovery &rsaquo; Clinical Analytics
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>
            Your Recovery Journey
          </h1>
        </div>
        <button
          onClick={() => navigate('/program')}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          Start Today's Session
        </button>
      </div>

      {/* Milestone Progress */}
      <div className="card p-6 bg-gradient-to-r from-primary-50 to-white border-primary-100">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-800">Milestone Progress</h3>
          <span className="text-[10px] font-bold text-primary-600 bg-primary-100 px-2.5 py-1 rounded-full">
            Phase {phaseIndex + 1}: {phaseLabel(currentPhase)}
          </span>
        </div>
        <ProgressStepper steps={steps} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Adherence</p>
            <p className="text-2xl font-bold text-neutral-800"><span ref={adherenceCountRef}>0</span>%</p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Days Streak</p>
            <p className="text-2xl font-bold text-neutral-800"><span ref={streakCountRef}>0</span></p>
          </div>
        </div>

        <div className="card p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Est. Recovery</p>
            <p className="text-2xl font-bold text-neutral-800">
              {estRecovery
                ? estRecovery.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : `${adherence.days_completed}d`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Two Column: Goal + Exercise Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Current Clinical Goal */}
        <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-3">Current Clinical Goal</p>
          {confirmedGoal ? (
            <>
              <h3 className="text-2xl font-bold leading-tight mb-2">
                {confirmedGoal.structured_goal?.activity || confirmedGoal.raw_text.slice(0, 60)}
              </h3>
              <p className="text-sm text-white/80 leading-relaxed flex-1">
                {confirmedGoal.raw_text.length > 60
                  ? confirmedGoal.raw_text.slice(0, 150) + (confirmedGoal.raw_text.length > 150 ? '...' : '')
                  : confirmedGoal.structured_goal?.instructions
                    ? confirmedGoal.structured_goal.instructions.slice(0, 150) + '...'
                    : ''
                }
              </p>
              {/* Goal metrics */}
              <div className="flex gap-4 mt-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-[10px] text-white/60">Current</p>
                  <p className="text-sm font-bold">{adherence.adherence_percentage}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/60">Target</p>
                  <p className="text-sm font-bold">100%</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/70">No goal set yet. Talk to your coach to set one.</p>
          )}
        </div>

        {/* Exercise Breakdown */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-neutral-800">Exercise Breakdown</h3>
              <p className="text-[11px] text-neutral-400 mt-0.5">Assigned for current phase</p>
            </div>
            <button className="text-neutral-300 hover:text-neutral-500 transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </button>
          </div>
          <div className="space-y-3">
            {exerciseStats.slice(0, 5).map((ex) => {
              const thumbUrl = ex.videoUrl
                ? `https://img.youtube.com/vi/${extractYoutubeId(ex.videoUrl)}/default.jpg`
                : null
              return (
                <div key={ex.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={ex.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-700 truncate">{ex.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-neutral-400">{ex.completed} SETS</span>
                      <span className="text-[10px] text-neutral-400">{ex.total} REPS</span>
                      <span className="text-[10px] text-neutral-400">{ex.total} DAILY</span>
                    </div>
                  </div>
                  <div className={`
                    px-2.5 py-1 rounded-full text-[11px] font-bold
                    ${ex.pct >= 80 ? 'bg-success-50 text-success-600'
                      : ex.pct >= 50 ? 'bg-primary-50 text-primary-600'
                      : 'bg-neutral-100 text-neutral-500'
                    }
                  `}>
                    {ex.pct.toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
          {exerciseStats.length > 5 && (
            <button
              onClick={() => navigate('/program')}
              className="mt-4 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors cursor-pointer"
            >
              View All {exerciseStats.length} Exercises
            </button>
          )}
        </div>
      </div>

      {/* Activity Calendar */}
      <div ref={calendarRef} className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-neutral-800">Activity Calendar</h3>
          <span className="text-sm text-neutral-400 font-medium">{monthName}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {/* Day headers */}
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-bold text-neutral-400 uppercase tracking-wider pb-2">
              {d.charAt(0)}
            </div>
          ))}
          {/* Calendar cells */}
          {calendarDays.map((day, i) => (
            <div key={i} className="flex items-center justify-center">
              {day.isEmpty ? (
                <div className="w-9 h-9" />
              ) : (
                <div data-cal-cell className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                  ${day.completed
                    ? 'bg-primary-500 text-white'
                    : day.isToday
                      ? 'bg-white text-primary-500 ring-2 ring-primary-400 font-bold'
                    : day.missed
                      ? 'bg-red-50 text-red-300'
                      : 'text-neutral-400'
                  }
                `}>
                  {day.completed ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : day.date}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-neutral-100">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary-500" />
            <span className="text-[10px] text-neutral-400 font-medium">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-100" />
            <span className="text-[10px] text-neutral-400 font-medium">Missed</span>
          </div>
        </div>
      </div>

      {/* Pain & Mood Trends */}
      <div className="card p-6">
        <h3 className="text-sm font-bold text-neutral-800 mb-4">Pain &amp; Mood Trends</h3>
        {checkins.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-6">
            Start logging daily check-ins to see trends
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-neutral-500">Pain Level</p>
                <p className="text-[10px] text-neutral-400">1 &ndash; 10</p>
              </div>
              <TrendChart
                data={checkins
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((c) => ({
                    label: new Date(c.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    value: c.pain_level,
                  }))}
                maxValue={10}
                color="#ef4444"
                gradientId="pain-gradient"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-neutral-500">Mood Level</p>
                <p className="text-[10px] text-neutral-400">1 &ndash; 5</p>
              </div>
              <TrendChart
                data={checkins
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((c) => ({
                    label: new Date(c.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                    value: c.mood_level,
                  }))}
                maxValue={5}
                color="#3b82f6"
                gradientId="mood-gradient"
              />
            </div>
          </div>
        )}
      </div>

      {/* Goal Plan (if exists) */}
      {confirmedGoal?.structured_goal?.instructions && (
        <div className="card p-6">
          <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">Your Plan</h3>
          <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">
            {confirmedGoal.structured_goal.instructions}
          </p>
          {confirmedGoal.structured_goal.precautions && (
            <div className="mt-4 bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Safety Notes</h4>
              </div>
              <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">
                {confirmedGoal.structured_goal.precautions}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
