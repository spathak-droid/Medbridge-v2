import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { usePatient } from '../hooks/usePatient'
import { Confetti } from '../components/ui/Confetti'
import { useToast } from '../contexts/ToastContext'
import {
  getAdherence,
  getExercisesToday,
  getGoals,
  getProgram,
  getSchedule,
} from '../lib/api'
import type { AdherenceSummary, Exercise, Goal, ProgramSummary, ScheduleEventItem } from '../lib/types'
import { BarChart } from '../components/ui/BarChart'
import { DailyCheckinCard } from '../components/DailyCheckinCard'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { OnboardingWizard } from '../components/OnboardingWizard'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function PatientDashboard() {
  const { patientId, patient } = usePatient()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('onboarding_complete') !== 'true',
  )
  const [showConfetti, setShowConfetti] = useState(false)
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [completedToday, setCompletedToday] = useState<string[]>([])
  const [currentGoal, setCurrentGoal] = useState<Goal | null>(null)
  const [nextSession, setNextSession] = useState<ScheduleEventItem | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    Promise.all([
      getAdherence(patientId).catch(() => null),
      getProgram(patientId).catch(() => null),
      getExercisesToday(patientId).catch(() => ({ completed_exercise_ids: [] })),
      getGoals(patientId).catch(() => []),
      getSchedule(patientId).catch(() => []),
    ]).then(([adh, prog, today, goals, schedule]) => {
      setAdherence(adh)
      setProgram(prog)
      setCompletedToday(today.completed_exercise_ids)
      const confirmed = goals.filter((g) => g.confirmed)
      if (confirmed.length > 0) setCurrentGoal(confirmed[confirmed.length - 1])
      const pending = schedule.filter((s) => s.status === 'PENDING')
      if (pending.length > 0) setNextSession(pending[0])
    }).finally(() => setLoading(false))
  }, [patientId])

  // Derived values (safe to compute even while loading)
  const firstName = patient?.name?.split(' ')[0] || 'there'
  const adherencePct = adherence?.adherence_percentage ?? 0
  const daysDone = adherence?.days_completed ?? 0
  const totalDays = adherence?.total_days_in_program ?? 0
  const streak = adherence?.current_streak ?? 0

  // Calculate adherence trend from weekly_breakdown or daily_log
  let trendDirection: 'up' | 'down' | 'flat' = 'flat'
  let trendDelta = 0
  if (adherence?.weekly_breakdown && adherence.weekly_breakdown.length >= 2) {
    const weeks = adherence.weekly_breakdown
    const curr = weeks[weeks.length - 1]
    const prev = weeks[weeks.length - 2]
    const currPct = curr.total > 0 ? (curr.completed / curr.total) * 100 : 0
    const prevPct = prev.total > 0 ? (prev.completed / prev.total) * 100 : 0
    trendDelta = Math.round(currPct - prevPct)
    if (trendDelta > 0) trendDirection = 'up'
    else if (trendDelta < 0) trendDirection = 'down'
  } else if (adherence?.daily_log && adherence.daily_log.length >= 2) {
    const log = adherence.daily_log
    const recentDays = log.slice(-7)
    const prevDays = log.slice(-14, -7)
    if (prevDays.length > 0) {
      const recentRate = (recentDays.filter((d) => d.completed).length / recentDays.length) * 100
      const prevRate = (prevDays.filter((d) => d.completed).length / prevDays.length) * 100
      trendDelta = Math.round(recentRate - prevRate)
      if (trendDelta > 0) trendDirection = 'up'
      else if (trendDelta < 0) trendDirection = 'down'
    }
  }

  const last7: { label: string; value: number; total: number }[] = []
  if (adherence?.daily_log) {
    const recent = adherence.daily_log.slice(-7)
    recent.forEach((d) => {
      const date = new Date(d.date)
      const dayName = DAY_LABELS[((date.getDay() + 6) % 7)]
      last7.push({ label: dayName, value: d.completed ? 1 : 0, total: 1 })
    })
  }
  while (last7.length < 7) {
    last7.unshift({ label: DAY_LABELS[last7.length % 7], value: 0, total: 1 })
  }

  const exercises = program?.exercises ?? []
  const firstExercise: Exercise | null = exercises[0] ?? null

  const goalText = patient?.goal_summary
    || (currentGoal?.structured_goal
      ? [
          currentGoal.structured_goal.activity,
          currentGoal.structured_goal.frequency
            ? `${currentGoal.structured_goal.frequency}x/${currentGoal.structured_goal.frequency_unit || 'week'}`
            : null,
          currentGoal.structured_goal.duration
            ? `for ${currentGoal.structured_goal.duration} ${currentGoal.structured_goal.duration_unit || 'minutes'}`
            : null,
        ].filter(Boolean).join(' ')
      : currentGoal?.raw_text?.slice(0, 200) || null)

  // Badges
  const longestStreak = adherence?.longest_streak ?? 0
  const badges = [
    {
      id: 'first-exercise',
      title: 'First Exercise',
      description: 'Completed your first day',
      earned: daysDone >= 1,
      gradient: 'from-emerald-400 to-emerald-600',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: '3-day-streak',
      title: '3-Day Streak',
      description: 'Exercised 3 days in a row',
      earned: streak >= 3 || longestStreak >= 3,
      gradient: 'from-orange-400 to-orange-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
        </svg>
      ),
    },
    {
      id: '7-day-streak',
      title: '7-Day Streak',
      description: 'A full week without missing',
      earned: streak >= 7 || longestStreak >= 7,
      gradient: 'from-red-400 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
        </svg>
      ),
    },
    {
      id: '50-adherence',
      title: '50% Adherence',
      description: 'Halfway to perfect adherence',
      earned: adherencePct >= 50,
      gradient: 'from-sky-400 to-sky-600',
      iconBg: 'bg-sky-100',
      iconColor: 'text-sky-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
    },
    {
      id: '80-adherence',
      title: '80% Adherence',
      description: 'Outstanding consistency',
      earned: adherencePct >= 80,
      gradient: 'from-violet-400 to-violet-600',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      ),
    },
    {
      id: 'week-complete',
      title: 'Week Complete',
      description: '7 days of exercises logged',
      earned: daysDone >= 7,
      gradient: 'from-amber-400 to-amber-600',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
  ]
  const earnedBadges = badges.filter((b) => b.earned)

  // Detect newly unlocked badges and celebrate
  useEffect(() => {
    if (loading || earnedBadges.length === 0) return
    const stored = localStorage.getItem('seen-badges')
    const seenIds: string[] = stored ? JSON.parse(stored) : []
    const newBadges = earnedBadges.filter((b) => !seenIds.includes(b.id))
    if (newBadges.length > 0) {
      setShowConfetti(true)
      newBadges.forEach((b) => {
        toast.success(`New badge unlocked: ${b.title}!`)
      })
      const updatedIds = earnedBadges.map((b) => b.id)
      localStorage.setItem('seen-badges', JSON.stringify(updatedIds))
      setTimeout(() => setShowConfetti(false), 3000)
    } else {
      // Keep seen-badges in sync even if no new ones
      const updatedIds = earnedBadges.map((b) => b.id)
      localStorage.setItem('seen-badges', JSON.stringify(updatedIds))
    }
  }, [loading, earnedBadges.length])

  // GSAP — all hooks must be called unconditionally (before any return)
  const greetRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const adherenceRef = useRef<HTMLSpanElement>(null)
  const badgesRef = useRef<HTMLDivElement>(null)
  const goalRef = useRef<HTMLDivElement>(null)
  const programRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (loading) return
    // Greeting slide in
    if (greetRef.current) {
      gsap.fromTo(greetRef.current, { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.7, ease: 'power3.out' })
    }
    // Stats stagger in
    if (statsRef.current) {
      const cards = statsRef.current.querySelectorAll(':scope > *')
      gsap.fromTo(cards, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out' })
    }
    // Count up adherence
    if (adherenceRef.current) {
      const obj = { val: 0 }
      const el = adherenceRef.current
      gsap.to(obj, {
        val: adherencePct, duration: 1.2, delay: 0.3, ease: 'power2.out',
        onUpdate: () => { el.textContent = Math.round(obj.val).toString() },
      })
    }
    // Badges pop-in
    if (badgesRef.current) {
      const items = badgesRef.current.querySelectorAll('[data-badge]')
      gsap.fromTo(items, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, stagger: 0.08, delay: 0.3, ease: 'back.out(1.7)' })
    }
    // Goal card
    if (goalRef.current) {
      gsap.fromTo(goalRef.current, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, delay: 0.4, ease: 'power3.out' })
    }
    // Program section
    if (programRef.current) {
      gsap.fromTo(programRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.55, ease: 'power3.out' })
    }
  }, [loading, adherencePct])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6">
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <Confetti active={showConfetti} />
      {/* Greeting */}
      <div ref={greetRef} style={{ opacity: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-800 tracking-tight">
          {getGreeting()}, {firstName}!
        </h1>
        {patient?.goal_summary && (
          <p className="text-sm text-neutral-400 mt-1">{patient.goal_summary}</p>
        )}
      </div>

      {/* Daily Check-in */}
      {patientId && <DailyCheckinCard patientId={patientId} />}

      {/* Stats Row */}
      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ opacity: 0 }}>
        {/* Adherence */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Adherence</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-bold text-primary-500"><span ref={adherenceRef}>0</span>%</p>
            {trendDirection === 'up' && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
                +{trendDelta}%
              </span>
            )}
            {trendDirection === 'down' && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
                </svg>
                {trendDelta}%
              </span>
            )}
            {trendDirection === 'flat' && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-neutral-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                </svg>
              </span>
            )}
          </div>
        </div>
        {/* Days Done */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Days Done</p>
          <p className="text-3xl font-bold text-neutral-800">{daysDone}/{totalDays}</p>
        </div>
        {/* Streak */}
        <div className="card p-5">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Streak</p>
          <p className="text-3xl font-bold text-neutral-800">{streak > 0 ? streak : '--'}</p>
        </div>
        {/* Last 7 Days Chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-neutral-800">Last 7 Days</p>
            <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <BarChart
            data={last7}
            height={60}
            colorFn={(v) => v > 0 ? 'bg-primary-500' : 'bg-neutral-200'}
          />
        </div>
      </div>

      {/* Achievement Badges */}
      {earnedBadges.length > 0 && (
        <div ref={badgesRef}>
          <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-3">Achievements</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-x-visible">
            {earnedBadges.map((badge) => (
              <div
                key={badge.id}
                data-badge
                className={`flex-shrink-0 w-36 sm:w-auto rounded-xl bg-gradient-to-br ${badge.gradient} p-[1px]`}
                style={{ opacity: 0 }}
              >
                <div className="rounded-[11px] bg-white p-3 h-full flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-full ${badge.iconBg} ${badge.iconColor} flex items-center justify-center`}>
                    {badge.icon}
                  </div>
                  <p className="text-xs font-bold text-neutral-800 leading-tight">{badge.title}</p>
                  <p className="text-[10px] text-neutral-400 leading-snug">{badge.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Goal */}
      {(currentGoal || goalText) && (
        <div ref={goalRef} style={{ opacity: 0 }} className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">Primary Goal</span>
          </div>
          <p className="text-lg font-semibold leading-relaxed line-clamp-3">
            {goalText || 'No goal set yet'}
          </p>
        </div>
      )}

      {/* Today's Program */}
      <div ref={programRef} style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-neutral-800">Today's Program</h2>
          <button
            onClick={() => navigate('/program')}
            className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors cursor-pointer"
          >
            View Full Program &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* First Exercise Card */}
          {firstExercise ? (
            <div className="card overflow-hidden">
              {firstExercise.video_url && (
                <div className="h-40 bg-neutral-200 overflow-hidden">
                  <img
                    src={`https://img.youtube.com/vi/${extractYoutubeId(firstExercise.video_url)}/hqdefault.jpg`}
                    alt={firstExercise.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="text-sm font-bold text-neutral-800 mb-2">{firstExercise.name}</h3>
                <div className="flex items-center gap-4 text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                  <div>
                    <span className="block text-neutral-400">Repetitions</span>
                    <span className="text-lg font-bold text-neutral-800">{firstExercise.reps}</span>
                  </div>
                  <div>
                    <span className="block text-neutral-400">Sets</span>
                    <span className="text-lg font-bold text-neutral-800">{firstExercise.sets}</span>
                  </div>
                  <button
                    onClick={() => navigate('/program')}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      completedToday.includes(firstExercise.id)
                        ? 'bg-success-500 text-white'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {completedToday.includes(firstExercise.id) ? 'Done' : 'Log'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-6 flex flex-col items-center justify-center text-center">
              <svg className="w-10 h-10 text-neutral-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <p className="text-sm font-medium text-neutral-400">No program assigned yet</p>
            </div>
          )}

          {/* Next Session */}
          <div className="card p-6 flex flex-col items-center justify-center text-center">
            <svg className="w-10 h-10 text-neutral-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-bold text-neutral-600">Next Session</p>
            <p className="text-xs text-neutral-400 mt-1">
              {nextSession
                ? `Scheduled for ${new Date(nextSession.scheduled_at).toLocaleDateString(undefined, { weekday: 'long' })}, ${new Date(nextSession.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                : 'No upcoming sessions'
              }
            </p>
          </div>

          {/* My Full Program CTA */}
          <div className="card p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-800 mb-1">My Full Program</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Access your complete {program ? `${program.duration_weeks}-week` : ''} rehabilitation timeline and instructional videos.
              </p>
            </div>
            <button
              onClick={() => navigate('/program')}
              className="mt-4 w-full py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              Open Program
            </button>
          </div>
        </div>
      </div>

      {/* Message Clinician FAB */}
      <button
        onClick={() => navigate('/messages')}
        className="fixed bottom-20 lg:bottom-6 right-6 bg-primary-600 hover:bg-primary-700 text-white pl-4 pr-5 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer z-30"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-bold">Message Clinician</span>
      </button>
    </div>
  )
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?/]+)/)
  return match ? match[1] : ''
}
