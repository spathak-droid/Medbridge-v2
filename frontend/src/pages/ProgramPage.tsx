import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import {
  clearProgram,
  getAdherence,
  getExercisesToday,
  getProgram,
  logExercise,
  unlogExercise,
} from '../lib/api'
import type { AdherenceSummary, ProgramSummary } from '../lib/types'
import { ExerciseCard } from '../components/cards/ExerciseCard'
import { Confetti } from '../components/ui/Confetti'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

function todayString() {
  return new Date().toISOString().split('T')[0]
}

export function ProgramPage() {
  const { patientId } = usePatient()
  const navigate = useNavigate()
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [completedToday, setCompletedToday] = useState<string[]>([])
  const [loggingExercise, setLoggingExercise] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const prevAllDoneRef = useRef(false)

  // Confetti hook — must be before any early returns
  const totalEx = program?.exercises.length ?? 0
  const programIds = program?.exercises.map((e) => e.id) ?? []
  const doneEx = completedToday.filter((id) => programIds.includes(id)).length
  const isAllDone = doneEx === totalEx && totalEx > 0

  useEffect(() => {
    if (isAllDone && !prevAllDoneRef.current) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      prevAllDoneRef.current = true
      return () => clearTimeout(timer)
    }
    prevAllDoneRef.current = isAllDone
  }, [isAllDone])

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    Promise.all([
      getProgram(patientId),
      getAdherence(patientId),
      getExercisesToday(patientId),
    ])
      .then(([prog, adh, today]) => {
        setProgram(prog)
        setAdherence(adh)
        setCompletedToday(today.completed_exercise_ids)
      })
      .catch((err) => setError(err.message || 'Failed to load program'))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleToggle = async (exerciseId: string) => {
    if (!patientId) return
    setLoggingExercise(exerciseId)
    const today = todayString()
    try {
      const isDone = completedToday.includes(exerciseId)
      if (isDone) {
        await unlogExercise(patientId, exerciseId, today)
        setCompletedToday((prev) => prev.filter((id) => id !== exerciseId))
      } else {
        await logExercise(patientId, exerciseId, today)
        setCompletedToday((prev) => [...prev, exerciseId])
      }
      const adh = await getAdherence(patientId)
      setAdherence(adh)
    } catch {
      // Silently fail
    } finally {
      setLoggingExercise(null)
    }
  }

  const handleClearProgram = async () => {
    if (!patientId) return
    setClearing(true)
    try {
      await clearProgram(patientId)
      setProgram(null)
      setAdherence(null)
      setCompletedToday([])
    } catch (err: any) {
      setError(err.message || 'Failed to clear program')
    } finally {
      setClearing(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
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

  // No program assigned — prompt to talk to AI coach
  if (!program) {
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="text-5xl mb-4">💬</div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">Get Your Personalized Plan</h2>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            Talk to your AI coach to get a program tailored to your needs — complete with
            exercises, video guides, safety tips, and a step-by-step plan.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Talk to AI Coach
          </button>
        </div>
      </div>
    )
  }

  const totalExercises = program.exercises.length
  const programExerciseIds = new Set(program.exercises.map((e) => e.id))
  const doneCount = completedToday.filter((id) => programExerciseIds.has(id)).length
  const allDone = doneCount === totalExercises && totalExercises > 0
  const streak = adherence?.current_streak ?? 0
  const overallPct = adherence?.adherence_percentage ?? 0

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full animate-fade-in">
      <Confetti active={showConfetti} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-800">{program.program_name}</h2>
          <p className="text-sm text-neutral-400 mt-1">
            {program.duration_weeks} weeks | {program.exercises.length} exercises
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/')}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              text-xs font-medium text-primary-600
              bg-primary-50 hover:bg-primary-100
              rounded-lg border border-primary-200
              transition-colors
            "
            title="Ask AI Coach to switch your program"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            Ask AI Coach
          </button>
          <button
            onClick={handleClearProgram}
            disabled={clearing}
            className="
              flex items-center gap-1.5 px-3 py-1.5
              text-xs font-medium text-neutral-500
              hover:text-red-600 hover:bg-red-50
              rounded-lg border border-neutral-200
              transition-colors
            "
            title="Clear current program"
          >
            {clearing ? (
              <span className="animate-spin">↻</span>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            Clear
          </button>
        </div>
      </div>

      {/* Stats row */}
      {adherence && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="card p-3 text-center">
            <div className={`text-lg font-bold ${
              overallPct >= 80 ? 'text-success-600' :
              overallPct >= 60 ? 'text-accent-600' :
              'text-warning-600'
            }`}>
              {overallPct.toFixed(0)}%
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Adherence</div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-bold text-primary-600">
              {streak > 0 ? streak : '--'}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {streak > 0 ? 'Day Streak' : 'No Streak'}
            </div>
          </div>
          <div className="card p-3 text-center">
            <div className="text-lg font-bold text-neutral-700">
              {adherence.days_completed}/{adherence.total_days_in_program}
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Days Done</div>
          </div>
        </div>
      )}

      {/* Today's progress */}
      <div className={`card p-4 mb-5 ${allDone ? 'bg-success-50 border-success-200' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-neutral-700">
            {allDone ? 'All done for today!' : "Today's Exercises"}
          </h3>
          <span className={`text-sm font-bold ${allDone ? 'text-success-600' : 'text-neutral-600'}`}>
            {doneCount}/{totalExercises}
          </span>
        </div>
        <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allDone ? 'bg-success-500' : 'bg-primary-500'
            }`}
            style={{ width: `${totalExercises > 0 ? (doneCount / totalExercises) * 100 : 0}%` }}
          />
        </div>
        {allDone && (
          <p className="text-xs text-success-600 mt-2 font-medium">
            Great job! You've completed all exercises for today.
            {streak > 1 ? ` ${streak}-day streak going strong!` : ''}
          </p>
        )}
      </div>

      {/* Exercise list */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-600">Your Exercises</h3>
        <span className="text-[11px] text-neutral-400">Tap to expand for details & videos</span>
      </div>
      <div className="space-y-3">
        {program.exercises.map((ex) => {
          const exAdh = adherence?.per_exercise?.[ex.id]
          return (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              completionPct={exAdh?.pct}
              isCompletedToday={completedToday.includes(ex.id)}
              onToggleComplete={handleToggle}
              isLogging={loggingExercise === ex.id}
            />
          )
        })}
      </div>
    </div>
  )
}
