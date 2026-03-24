import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import { getAdherence, getGoals, getProgram, getSchedule } from '../lib/api'
import type { AdherenceSummary, Goal, ProgramSummary, ScheduleEventItem } from '../lib/types'
import { adherenceColor, adherenceBgColor, phaseLabel } from '../lib/utils'
import { BarChart } from '../components/ui/BarChart'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { ProgressStepper } from '../components/ui/ProgressStepper'

const PHASE_ORDER = ['PENDING', 'ONBOARDING', 'ACTIVE', 'RE_ENGAGING', 'DORMANT']

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMotivationalMessage(adherence: AdherenceSummary): { text: string; emoji: string; color: string } {
  const pct = adherence.adherence_percentage
  const streak = adherence.current_streak
  const status = adherence.status

  if (pct >= 80 && streak >= 5) {
    return { text: "You're on fire! Incredible consistency — keep this momentum going.", emoji: '🏆', color: 'text-success-700' }
  }
  if (pct >= 80) {
    return { text: "Outstanding adherence! You're building a strong foundation for recovery.", emoji: '⭐', color: 'text-success-700' }
  }
  if (streak >= 3) {
    return { text: `${streak}-day streak! Each day you show up, you're getting stronger.`, emoji: '🔥', color: 'text-amber-600' }
  }
  if (pct >= 60) {
    return { text: "Good progress! A little more consistency will make a big difference.", emoji: '💪', color: 'text-accent-600' }
  }
  if (status === 'DECLINING') {
    return { text: "It's okay to have setbacks. Even one exercise today is a win.", emoji: '🌱', color: 'text-primary-600' }
  }
  if (pct >= 40) {
    return { text: "You're building the habit — every session counts toward your goal.", emoji: '🚶', color: 'text-warning-600' }
  }
  if (status === 'NEW') {
    return { text: "Welcome! Completing your first exercises is the hardest part — and you've started.", emoji: '🎉', color: 'text-primary-600' }
  }
  return { text: "Small steps lead to big changes. Try just one exercise today.", emoji: '💡', color: 'text-neutral-600' }
}

export function ProgressPage() {
  const { patientId, patient } = usePatient()
  const navigate = useNavigate()
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [schedule, setSchedule] = useState<ScheduleEventItem[]>([])
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
    ])
      .then(([adh, g, prog, sched]) => {
        setAdherence(adh)
        setGoals(g)
        setProgram(prog)
        setSchedule(sched)
      })
      .catch((err) => setError(err.message || 'Failed to load progress'))
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto w-full">
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
    { label: 'Active', status: phaseIndex >= 2 ? (currentPhase === 'ACTIVE' ? 'active' as const : 'completed' as const) : 'upcoming' as const },
    { label: phaseLabel(currentPhase === 'RE_ENGAGING' ? 'RE_ENGAGING' : currentPhase === 'DORMANT' ? 'DORMANT' : 'ACTIVE'), status: currentPhase === 'RE_ENGAGING' || currentPhase === 'DORMANT' ? 'active' as const : 'upcoming' as const },
  ]

  const confirmedGoal = goals.find((g) => g.confirmed)
  const motivation = adherence ? getMotivationalMessage(adherence) : null

  // Per-exercise stats
  const exerciseStats = adherence?.per_exercise
    ? Object.entries(adherence.per_exercise).map(([id, stats]) => {
        const exercise = program?.exercises.find((e) => e.id === id)
        return { id, name: exercise?.name || id, ...stats }
      })
    : []

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full animate-fade-in">
      <h2 className="text-xl font-bold text-neutral-800 mb-6">Your Progress</h2>

      {/* Motivational banner */}
      {motivation && (
        <div className="card p-4 mb-6 bg-gradient-to-r from-primary-50 to-white border-primary-100">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{motivation.emoji}</span>
            <p className={`text-sm font-medium ${motivation.color} leading-relaxed`}>
              {motivation.text}
            </p>
          </div>
        </div>
      )}

      {/* Phase stepper */}
      <div className="card p-5 mb-6">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Journey</h3>
        <ProgressStepper steps={steps} />
      </div>

      {/* Stats row */}
      {adherence && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <div className={`text-2xl font-bold ${adherenceColor(adherence.adherence_percentage)}`}>
              {adherence.adherence_percentage}%
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Adherence</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">
              🔥 {adherence.current_streak}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Day Streak</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-bold text-neutral-700">
              {adherence.days_completed}
            </div>
            <div className="text-[11px] text-neutral-400 mt-1">Days Done</div>
          </div>
        </div>
      )}

      {/* Last 7 days heatmap */}
      {adherence && adherence.daily_log.length > 0 && (() => {
        // Build a full 7-day grid ending today, merging with available log data
        const logMap = new Map(adherence.daily_log.map(d => [d.date, d]))
        const days: { date: string; completed: boolean; exercises_done: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const entry = logMap.get(dateStr)
          days.push(entry ?? { date: dateStr, completed: false, exercises_done: 0 })
        }
        return (
          <div className="card p-5 mb-6">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Last 7 Days</h3>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => {
                const d = new Date(day.date + 'T00:00:00')
                const dayName = DAY_NAMES[d.getDay()]
                const dayNum = d.getDate()
                const isToday = day.date === new Date().toISOString().split('T')[0]
                return (
                  <div key={day.date} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[10px] font-medium ${isToday ? 'text-primary-600' : 'text-neutral-400'}`}>
                      {isToday ? 'Today' : dayName}
                    </span>
                    <div className={`
                      w-9 h-9 rounded-xl flex items-center justify-center
                      text-xs font-bold transition-all
                      ${day.completed
                        ? 'bg-success-500 text-white shadow-sm'
                        : isToday
                          ? 'bg-primary-50 text-primary-400 ring-2 ring-primary-200'
                          : 'bg-neutral-100 text-neutral-400'
                      }
                    `}>
                      {day.completed ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : dayNum}
                    </div>
                    {day.exercises_done > 0 && (
                      <span className="text-[9px] text-success-600 font-medium">
                        {day.exercises_done} done
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Weekly breakdown */}
      {adherence && adherence.weekly_breakdown.length > 1 && (
        <div className="card p-5 mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Weekly Progress</h3>
          <BarChart
            data={adherence.weekly_breakdown.map((w) => ({
              label: `Wk ${w.week}`,
              value: w.completed,
              total: w.total,
            }))}
            height={100}
          />
        </div>
      )}
      {adherence && adherence.weekly_breakdown.length === 1 && (
        <div className="card p-5 mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">This Week</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-neutral-600">Week {adherence.weekly_breakdown[0].week}</span>
                <span className="text-xs font-bold text-neutral-700">
                  {adherence.weekly_breakdown[0].completed}/{adherence.weekly_breakdown[0].total} days
                </span>
              </div>
              <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${adherenceBgColor(
                    adherence.weekly_breakdown[0].total > 0
                      ? (adherence.weekly_breakdown[0].completed / adherence.weekly_breakdown[0].total) * 100
                      : 0
                  )}`}
                  style={{
                    width: `${adherence.weekly_breakdown[0].total > 0
                      ? Math.max((adherence.weekly_breakdown[0].completed / adherence.weekly_breakdown[0].total) * 100, 4)
                      : 0}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-exercise breakdown */}
      {exerciseStats.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Exercise Breakdown</h3>
          <div className="space-y-3">
            {exerciseStats.sort((a, b) => a.pct - b.pct).map((ex) => (
              <div key={ex.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-neutral-700 truncate mr-2">{ex.name}</span>
                  <span className={`text-xs font-bold flex-shrink-0 ${
                    ex.pct >= 80 ? 'text-success-600' :
                    ex.pct >= 60 ? 'text-accent-600' :
                    ex.pct >= 40 ? 'text-warning-600' :
                    'text-danger-600'
                  }`}>
                    {ex.completed}/{ex.total} ({ex.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${adherenceBgColor(ex.pct)}`}
                    style={{ width: `${Math.max(ex.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal */}
      {confirmedGoal && (
        <div className="card p-5 mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Current Goal</h3>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-800">{confirmedGoal.raw_text}</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Set {new Date(confirmedGoal.created_at).toLocaleDateString()}
              </p>

              {/* Goal details: instructions */}
              {confirmedGoal.structured_goal?.instructions && (
                <div className="mt-3 bg-primary-50/60 rounded-lg p-3 border border-primary-100">
                  <h4 className="text-[10px] font-bold text-primary-700 uppercase tracking-wider mb-1.5">Your Plan</h4>
                  <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">
                    {confirmedGoal.structured_goal.instructions}
                  </p>
                </div>
              )}

              {/* Goal details: precautions */}
              {confirmedGoal.structured_goal?.precautions && (
                <div className="mt-2 bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs">⚠️</span>
                    <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Safety Notes</h4>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-line">
                    {confirmedGoal.structured_goal.precautions}
                  </p>
                </div>
              )}

              {/* Video guide */}
              {confirmedGoal.structured_goal?.video_url && (
                <a
                  href={confirmedGoal.structured_goal.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-2.5 p-2.5 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors group"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center group-hover:bg-red-600 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-neutral-800 truncate">
                      {confirmedGoal.structured_goal.video_title || 'Watch Video Guide'}
                    </p>
                    <p className="text-[10px] text-neutral-400">Watch on YouTube</p>
                  </div>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming reminders & scheduled events */}
      {schedule.length > 0 && (() => {
        const upcoming = schedule
          .filter((e) => e.status === 'PENDING')
          .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        const past = schedule
          .filter((e) => e.status === 'SENT' && e.message)
          .sort((a, b) => new Date(b.executed_at || b.scheduled_at).getTime() - new Date(a.executed_at || a.scheduled_at).getTime())
          .slice(0, 3)

        if (upcoming.length === 0 && past.length === 0) return null
        return (
          <div className="card p-5 mb-6">
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
              Reminders & Check-ins
            </h3>
            {upcoming.length > 0 && (
              <div className="space-y-2 mb-3">
                {upcoming.slice(0, 5).map((e) => {
                  const date = new Date(e.scheduled_at)
                  const isReminder = e.event_type === 'REMINDER'
                  return (
                    <div key={e.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${
                      isReminder ? 'bg-amber-50 border border-amber-100' : 'bg-blue-50 border border-blue-100'
                    }`}>
                      <span className="text-lg flex-shrink-0">
                        {isReminder ? '⏰' : e.event_type === 'WEEKLY_DIGEST' ? '📊' : '📬'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-700">
                          {isReminder ? 'Reminder' : e.event_type === 'WEEKLY_DIGEST' ? 'Weekly Digest' : e.event_type.replace('_', ' ')}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {e.message && (
                          <p className="text-[11px] text-neutral-600 mt-0.5 truncate">{e.message}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        Upcoming
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {past.length > 0 && (
              <>
                {upcoming.length > 0 && (
                  <div className="text-[10px] text-neutral-400 font-medium mb-2">Recent</div>
                )}
                <div className="space-y-1.5">
                  {past.map((e) => (
                    <div key={e.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-neutral-50">
                      <span className="text-sm flex-shrink-0 mt-0.5">
                        {e.event_type === 'REMINDER' ? '⏰' : e.event_type === 'WEEKLY_DIGEST' ? '📊' : '✅'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-neutral-600 line-clamp-2">{e.message}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {new Date(e.executed_at || e.scheduled_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* Quick actions */}
      {adherence && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate('/program')}
            className="card p-4 text-center hover:shadow-card-hover transition-all group"
          >
            <div className="text-2xl mb-1">🏋️</div>
            <span className="text-xs font-semibold text-neutral-700 group-hover:text-primary-600">
              Go to Exercises
            </span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="card p-4 text-center hover:shadow-card-hover transition-all group"
          >
            <div className="text-2xl mb-1">💬</div>
            <span className="text-xs font-semibold text-neutral-700 group-hover:text-primary-600">
              Talk to Coach
            </span>
          </button>
        </div>
      )}

      {!adherence && (
        <div className="card p-8 text-center">
          <div className="text-5xl mb-4">🌟</div>
          <h3 className="text-lg font-bold text-neutral-800 mb-2">Your Journey Starts Here</h3>
          <p className="text-sm text-neutral-500 mb-5 leading-relaxed max-w-sm mx-auto">
            Once you begin your exercise program, this page will show your streaks,
            adherence trends, and weekly progress to keep you motivated.
          </p>
          <button
            onClick={() => navigate('/program')}
            className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
          >
            View Your Program
          </button>
        </div>
      )}
    </div>
  )
}
