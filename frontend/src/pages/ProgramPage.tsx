import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { usePatient } from '../hooks/usePatient'
import { useAuth } from '../contexts/AuthContext'
import {
  clearProgram,
  getAdherence,
  getExercisesToday,
  getPatientNotesPatientView,
  getProgram,
  getRatedExercises,
  getVideoProgress,
  logExercise,
  logVideoProgress,
  rateExercises,
  unlogExercise,
} from '../lib/api'
import type { AdherenceSummary, ClinicalNote, Exercise, ProgramSummary } from '../lib/types'
import { Badge } from '../components/ui/Badge'
import { Confetti } from '../components/ui/Confetti'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { useToast } from '../contexts/ToastContext'

// YouTube IFrame API loader
let ytApiLoaded = false
let ytApiReady = false
const ytReadyCallbacks: (() => void)[] = []

function loadYouTubeApi(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) { resolve(); return }
    ytReadyCallbacks.push(resolve)
    if (ytApiLoaded) return
    ytApiLoaded = true
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    ;(window as any).onYouTubeIframeAPIReady = () => {
      ytApiReady = true
      ytReadyCallbacks.forEach((cb) => cb())
      ytReadyCallbacks.length = 0
    }
  })
}

function todayString() {
  return new Date().toISOString().split('T')[0]
}

function extractYoutubeId(url: string): string {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([^&?/]+)/)
  return match ? match[1] : ''
}

export function ProgramPage() {
  const { patientId } = usePatient()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [completedToday, setCompletedToday] = useState<string[]>([])
  const [loggingExercise, setLoggingExercise] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showRateUs, setShowRateUs] = useState(false)
  const [rateUsRating, setRateUsRating] = useState(0)
  const [rateUsSubmitted, setRateUsSubmitted] = useState(false)
  const [ratedFingerprints, setRatedFingerprints] = useState<Set<string>>(new Set())
  const [videoProgress, setVideoProgress] = useState<Record<string, { watch_percentage: number; is_watched: boolean }>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [ptNotes, setPtNotes] = useState<ClinicalNote[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const prevAllDoneRef = useRef(false)

  // YouTube player refs
  const playerRef = useRef<any>(null)
  const playerWrapperRef = useRef<HTMLDivElement>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxWatchPctRef = useRef(0)

  const totalEx = program?.exercises.length ?? 0
  const programIds = program?.exercises.map((e) => e.id) ?? []
  const doneEx = completedToday.filter((id) => programIds.includes(id)).length
  const isAllDone = doneEx === totalEx && totalEx > 0
  const exerciseFingerprint = programIds.slice().sort().join(',')

  // Active exercise
  const activeExercise: Exercise | null = program?.exercises[activeIndex] ?? null

  useEffect(() => {
    if (!patientId) return
    getRatedExercises(patientId)
      .then((fps) => setRatedFingerprints(new Set(fps)))
      .catch(() => {})
  }, [patientId])

  useEffect(() => {
    if (isAllDone && !prevAllDoneRef.current) {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3500)
      prevAllDoneRef.current = true
      if (exerciseFingerprint && !ratedFingerprints.has(exerciseFingerprint)) {
        const rateTimer = setTimeout(() => setShowRateUs(true), 1800)
        return () => { clearTimeout(timer); clearTimeout(rateTimer) }
      }
      return () => clearTimeout(timer)
    }
    prevAllDoneRef.current = isAllDone
  }, [isAllDone, exerciseFingerprint, ratedFingerprints])

  const handleRateUsDismiss = () => {
    setShowRateUs(false)
    setRatedFingerprints((prev) => new Set(prev).add(exerciseFingerprint))
  }

  const handleRateUsSubmit = () => {
    setRateUsSubmitted(true)
    setRatedFingerprints((prev) => new Set(prev).add(exerciseFingerprint))
    if (patientId && exerciseFingerprint) {
      rateExercises(patientId, exerciseFingerprint, rateUsRating).catch(() => {})
    }
    setTimeout(() => {
      setShowRateUs(false)
      setRateUsSubmitted(false)
      setRateUsRating(0)
    }, 1500)
  }

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    Promise.all([
      getProgram(patientId),
      getAdherence(patientId),
      getExercisesToday(patientId),
      getVideoProgress(patientId),
      getPatientNotesPatientView(patientId).catch(() => []),
    ])
      .then(([prog, adh, today, vidProgress, notes]) => {
        setProgram(prog)
        setAdherence(adh)
        setCompletedToday(today.completed_exercise_ids)
        setVideoProgress(vidProgress.video_progress)
        setPtNotes(notes)
        // Auto-select first incomplete exercise
        if (prog?.exercises) {
          const firstIncomplete = prog.exercises.findIndex(
            (e) => !today.completed_exercise_ids.includes(e.id)
          )
          if (firstIncomplete >= 0) setActiveIndex(firstIncomplete)
        }
      })
      .catch((err) => setError(err.message || 'Failed to load program'))
      .finally(() => setLoading(false))
  }, [patientId])

  // YouTube player for active exercise — managed outside React DOM to avoid removeChild errors
  useEffect(() => {
    const wrapper = playerWrapperRef.current
    if (!activeExercise?.video_id || !wrapper) return
    maxWatchPctRef.current = videoProgress[activeExercise.id]?.watch_percentage ?? 0

    // Create a fresh div for the YouTube API to replace with an iframe
    wrapper.innerHTML = ''
    const target = document.createElement('div')
    target.style.width = '100%'
    target.style.height = '100%'
    wrapper.appendChild(target)

    let player: any = null
    loadYouTubeApi().then(() => {
      // Guard: wrapper may have been cleaned up already
      if (!wrapper.contains(target)) return
      player = new (window as any).YT.Player(target, {
        videoId: activeExercise.video_id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (event: any) => {
            const YT = (window as any).YT
            if (event.data === YT.PlayerState.PLAYING) {
              if (!progressIntervalRef.current) {
                progressIntervalRef.current = setInterval(() => {
                  if (!player?.getCurrentTime || !player?.getDuration) return
                  const pct = (player.getCurrentTime() / player.getDuration()) * 100
                  maxWatchPctRef.current = Math.max(maxWatchPctRef.current, pct)
                }, 5000)
              }
            } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current)
                progressIntervalRef.current = null
              }
              if (player?.getCurrentTime && player?.getDuration) {
                const pct = (player.getCurrentTime() / player.getDuration()) * 100
                maxWatchPctRef.current = Math.max(maxWatchPctRef.current, pct)
              }
              if (maxWatchPctRef.current > 0) {
                handleVideoProgress(activeExercise.id, maxWatchPctRef.current)
              }
            }
          },
        },
      })
      playerRef.current = player
    })

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      if (maxWatchPctRef.current > (videoProgress[activeExercise.id]?.watch_percentage ?? 0)) {
        handleVideoProgress(activeExercise.id, maxWatchPctRef.current)
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
      // Clean up DOM nodes that YouTube injected
      if (wrapper) wrapper.innerHTML = ''
    }
  }, [activeExercise?.id, activeExercise?.video_id])

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
        toast.success('Exercise logged!')
      }
      const adh = await getAdherence(patientId)
      setAdherence(adh)
    } catch {
    } finally {
      setLoggingExercise(null)
    }
  }

  const handleVideoProgress = async (exerciseId: string, percentage: number) => {
    if (!patientId) return
    const today = todayString()
    try {
      const result = await logVideoProgress(patientId, exerciseId, percentage, today)
      setVideoProgress((prev) => ({
        ...prev,
        [exerciseId]: { watch_percentage: result.watch_percentage, is_watched: result.is_watched },
      }))
      const adh = await getAdherence(patientId)
      setAdherence(adh)
    } catch {}
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

  const handleCompleteAndNext = async () => {
    if (!activeExercise) return
    if (!completedToday.includes(activeExercise.id)) {
      await handleToggle(activeExercise.id)
    }
    if (activeIndex < totalEx - 1) {
      setActiveIndex(activeIndex + 1)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
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

  if (!program) {
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-800 mb-2">Get Your Personalized Plan</h2>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            Talk to your AI coach to get a program tailored to your needs.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            Talk to AI Coach
          </button>
        </div>
      </div>
    )
  }

  const exercises = program.exercises
  const streak = adherence?.current_streak ?? 0
  const totalMinutes = exercises.reduce((sum, e) => sum + Math.ceil((e.sets * e.reps * Math.max(e.hold_time_seconds, 3)) / 60), 0)
  const currentWeek = adherence ? Math.min(Math.ceil((adherence.days_completed + 1) / 7), program.duration_weeks) : 1

  const handlePrintExercises = () => {
    const exerciseBlocks = exercises.map((ex, i) => {
      const holdText = ex.hold_time_seconds > 0 ? ` | Hold: ${ex.hold_time_seconds}s` : ''
      const descSteps = ex.description
        ? ex.description.split(/\.\s+/).filter(Boolean).map((s) => s.replace(/\.$/, '').trim() + '.')
        : []
      return `
        <div class="exercise-block">
          <div class="exercise-header">
            <div class="checkbox"></div>
            <div class="exercise-title">
              <h2>${i + 1}. ${ex.name}</h2>
              <p class="exercise-params">${ex.sets} sets x ${ex.reps} reps${holdText}</p>
            </div>
          </div>
          ${descSteps.length > 0 ? `
            <div class="exercise-section">
              <h3>How to do it</h3>
              <ul>${descSteps.map((s) => `<li>${s}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${ex.tips ? `
            <div class="exercise-section">
              <h3>Tips</h3>
              <p class="tip-text">${ex.tips}</p>
            </div>
          ` : ''}
          ${ex.precautions ? `
            <div class="exercise-section precaution">
              <h3>Precautions</h3>
              <p>${ex.precautions}</p>
            </div>
          ` : ''}
        </div>
      `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${program.program_name} - Exercise Plan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a1a;
      line-height: 1.6;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .page-header {
      border-bottom: 2px solid #e5e5e5;
      padding-bottom: 20px;
      margin-bottom: 32px;
    }
    .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .page-header .meta {
      font-size: 14px;
      color: #666;
    }
    .page-header .stats {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      font-size: 13px;
      color: #444;
    }
    .page-header .stats strong {
      font-weight: 600;
    }
    .exercise-block {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .exercise-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 14px;
    }
    .checkbox {
      width: 22px;
      height: 22px;
      border: 2px solid #bbb;
      border-radius: 4px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .exercise-title h2 {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    .exercise-params {
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }
    .exercise-section {
      margin-top: 12px;
      padding-left: 36px;
    }
    .exercise-section h3 {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #888;
      margin-bottom: 6px;
    }
    .exercise-section ul {
      padding-left: 18px;
    }
    .exercise-section li {
      font-size: 14px;
      color: #333;
      margin-bottom: 4px;
    }
    .exercise-section p {
      font-size: 14px;
      color: #333;
    }
    .tip-text {
      font-style: italic;
    }
    .precaution {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      border-radius: 4px;
      padding: 10px 14px;
      margin-left: 36px;
    }
    .precaution h3 {
      color: #b45309;
    }
    .precaution p {
      color: #92400e;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .exercise-block { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>${program.program_name}</h1>
    <p class="meta">Week ${currentWeek} of ${program.duration_weeks}</p>
    <div class="stats">
      <span><strong>${exercises.length}</strong> exercises</span>
      <span><strong>${totalMinutes}</strong> minutes</span>
      <span>Printed ${new Date().toLocaleDateString()}</span>
    </div>
  </div>
  ${exerciseBlocks}
  <div class="footer">Check off each exercise as you complete it. If anything causes pain, stop and contact your clinician.</div>
</body>
</html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => printWindow.print()
    }
  }

  // Split description into bullet points for "How to do it"
  const descriptionSteps = activeExercise?.description
    ? activeExercise.description.split(/\.\s+/).filter(Boolean).map((s) => s.replace(/\.$/, '').trim() + '.')
    : []

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden animate-fade-in">
      <Confetti active={showConfetti} />

      {/* Main content - left side */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl">
          {/* Program header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                <span className="text-xs font-semibold text-neutral-400">
                  Week {currentWeek} of {program.duration_weeks}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">{program.program_name}</h1>
              <p className="text-sm text-neutral-400 mt-1 leading-relaxed max-w-lg">
                Focusing on restoring range of motion and building strength for your recovery.
              </p>
            </div>
            <div className="hidden sm:flex gap-3 items-start">
              <div className="card px-4 py-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <div>
                  <p className="text-xl font-bold text-neutral-800">{totalEx}</p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Exercises</p>
                </div>
              </div>
              <div className="card px-4 py-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-xl font-bold text-neutral-800">{totalMinutes}</p>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Minutes</p>
                </div>
              </div>
              <button
                onClick={handlePrintExercises}
                className="card px-3 py-3 flex items-center justify-center hover:bg-neutral-50 transition-colors cursor-pointer"
                title="Print exercises"
              >
                <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.25 7.034V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659" />
                </svg>
              </button>
            </div>
          </div>

          {/* Active exercise detail */}
          {activeExercise && (
            <div key={activeExercise.id} ref={(el) => {
              if (el) gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
            }} className="space-y-6">
              {/* Video area */}
              {activeExercise.video_id ? (
                <div className="rounded-2xl overflow-hidden bg-neutral-900 shadow-lg">
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <div ref={playerWrapperRef} className="absolute inset-0 w-full h-full" />
                  </div>
                  <div className="flex items-center justify-center gap-2 py-2 bg-neutral-800">
                    <svg className="w-3.5 h-3.5 text-neutral-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    <span className="text-[11px] text-neutral-400 font-medium">Watch on CareArc Video</span>
                  </div>
                </div>
              ) : activeExercise.video_url ? (
                <div className="rounded-2xl overflow-hidden bg-neutral-900 shadow-lg relative" style={{ paddingBottom: '56.25%' }}>
                  <img
                    src={`https://img.youtube.com/vi/${extractYoutubeId(activeExercise.video_url)}/hqdefault.jpg`}
                    alt={activeExercise.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <a
                    href={activeExercise.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                      <svg className="w-7 h-7 text-neutral-800 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </a>
                </div>
              ) : null}

              {/* Exercise name & badge */}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-neutral-800">{activeExercise.name}</h2>
                  <Badge variant={activeExercise.difficulty === 'intermediate' ? 'warning' : 'success'}>
                    {activeExercise.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner'}
                  </Badge>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => setFavorites((prev) => {
                        const next = new Set(prev)
                        if (next.has(activeExercise.id)) next.delete(activeExercise.id)
                        else next.add(activeExercise.id)
                        return next
                      })}
                      className="p-2 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="Favorite"
                    >
                      <svg
                        className={`w-5 h-5 transition-colors ${favorites.has(activeExercise.id) ? 'text-red-500 fill-red-500' : 'text-neutral-400'}`}
                        fill={favorites.has(activeExercise.id) ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: activeExercise.name, text: `Check out this exercise: ${activeExercise.name}` }).catch(() => {})
                        }
                      }}
                      className="p-2 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="Share"
                    >
                      <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
                  {activeExercise.description.split('.')[0]}.
                </p>
              </div>

              {/* Stats boxes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Reps</p>
                  <p className="text-2xl font-bold text-neutral-800">{activeExercise.reps}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Sets</p>
                  <p className="text-2xl font-bold text-neutral-800">{activeExercise.sets}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Hold</p>
                  <p className="text-2xl font-bold text-neutral-800">
                    {activeExercise.hold_time_seconds > 0 ? `${activeExercise.hold_time_seconds}s` : '--'}
                  </p>
                </div>
              </div>

              {/* How to do it + Pro Tips side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* How to do it */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">1</span>
                    <h3 className="text-sm font-bold text-neutral-800">How to do it</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {descriptionSteps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-600 leading-relaxed">
                        <span className="text-neutral-300 mt-1">&#x2022;</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Pro Tips */}
                {activeExercise.tips && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full bg-success-100 flex items-center justify-center text-xs font-bold text-success-600">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                        </svg>
                      </span>
                      <h3 className="text-sm font-bold text-neutral-800">Pro Tips</h3>
                    </div>
                    <div className="bg-primary-50/50 border border-primary-100 rounded-xl p-4">
                      <p className="text-sm text-neutral-600 leading-relaxed italic">
                        "{activeExercise.tips}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Notice */}
              {activeExercise.precautions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 mb-1">Safety Notice</h4>
                    <p className="text-sm text-amber-700 leading-relaxed">{activeExercise.precautions}</p>
                  </div>
                </div>
              )}

              {/* Bottom navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <button
                  onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                  disabled={activeIndex === 0}
                  className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Previous Exercise
                </button>
                <button
                  onClick={handleCompleteAndNext}
                  disabled={loggingExercise === activeExercise.id}
                  className="btn-primary px-6 py-3 text-sm flex items-center gap-2"
                >
                  {completedToday.includes(activeExercise.id)
                    ? activeIndex < totalEx - 1 ? 'Next Exercise' : 'All Done!'
                    : 'Complete & Next'
                  }
                  {activeIndex < totalEx - 1 && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Clinician controls */}
          {user?.role === 'clinician' && (
            <div className="mt-6 pt-4 border-t border-neutral-200">
              <button
                onClick={handleClearProgram}
                disabled={clearing}
                className="text-xs font-medium text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                {clearing ? 'Clearing...' : 'Clear Program'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar - Today's Program */}
      <aside className="hidden lg:flex flex-col w-80 border-l border-neutral-200 bg-white overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-neutral-800">Today's Program</h3>
          <span className="text-xs text-neutral-400">{totalEx} total</span>
        </div>

        {/* Exercise list */}
        <div className="space-y-2 mb-4">
          {exercises.map((ex, i) => {
            const isDone = completedToday.includes(ex.id)
            const isActive = i === activeIndex
            const isNext = !isDone && i > activeIndex && !exercises.slice(activeIndex + 1, i).some((e) => !completedToday.includes(e.id))
            const vidProg = videoProgress[ex.id]
            const thumbUrl = ex.video_url
              ? `https://img.youtube.com/vi/${extractYoutubeId(ex.video_url)}/default.jpg`
              : null

            return (
              <button
                key={ex.id}
                onClick={() => setActiveIndex(i)}
                className={`
                  w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer
                  ${isActive
                    ? 'bg-primary-50 border border-primary-200 shadow-sm'
                    : 'hover:bg-neutral-50'
                  }
                `}
              >
                {/* Thumbnail or status icon */}
                <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center">
                  {isDone ? (
                    <div className="w-full h-full bg-success-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  ) : thumbUrl ? (
                    <img src={thumbUrl} alt={ex.name} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isDone ? 'text-neutral-400' : 'text-neutral-800'}`}>
                    {ex.name}
                  </p>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${
                    isDone ? 'text-success-500'
                    : isActive ? 'text-primary-500'
                    : isNext ? 'text-neutral-400'
                    : 'text-neutral-300'
                  }`}>
                    {isDone ? 'Completed'
                    : isActive ? `In Progress \u00B7 ${ex.sets} sets`
                    : isNext ? `Next Up \u00B7 ${ex.hold_time_seconds > 0 ? `${Math.ceil(ex.sets * ex.reps * ex.hold_time_seconds / 60)} min` : `${ex.reps} reps`}`
                    : `Locked \u00B7 ${ex.reps} reps`
                    }
                  </p>
                </div>

                {/* Play icon for active */}
                {isActive && !isDone && (
                  <svg className="w-5 h-5 text-primary-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => {/* scroll to top or expand all */}}
          className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors text-center cursor-pointer"
        >
          View All {totalEx} Exercises
        </button>

        {/* Progress summary */}
        <div className="mt-6 pt-4 border-t border-neutral-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">Today's Progress</span>
            <span className="text-xs font-bold text-neutral-800">{doneEx}/{totalEx}</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isAllDone ? 'bg-success-500' : 'bg-primary-500'}`}
              style={{ width: `${totalEx > 0 ? (doneEx / totalEx) * 100 : 0}%` }}
            />
          </div>
          {streak > 0 && (
            <p className="text-[11px] text-neutral-400 mt-2">{streak}-day streak going!</p>
          )}
        </div>

        {/* PT Note */}
        {ptNotes.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                  PT
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-800">PT Note</p>
                  <p className="text-[10px] text-neutral-400">
                    {new Date(ptNotes[0].created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed italic">
                "{ptNotes[0].content}"
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* Rate Us Modal */}
      {showRateUs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleRateUsDismiss} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-fade-in-up">
            {rateUsSubmitted ? (
              <>
                <div className="text-5xl mb-3">&#10024;</div>
                <h3 className="text-lg font-bold text-neutral-800">Thank you!</h3>
                <p className="text-sm text-neutral-500 mt-1">Your feedback means a lot.</p>
              </>
            ) : (
              <>
                <button
                  onClick={handleRateUsDismiss}
                  className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="text-5xl mb-3">&#127881;</div>
                <h3 className="text-lg font-bold text-neutral-800 mb-1">Amazing work!</h3>
                <p className="text-sm text-neutral-500 mb-5">You crushed your exercises. How's your experience so far?</p>
                <div className="flex justify-center gap-2 mb-5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRateUsRating(star)}
                      className="transition-transform hover:scale-110 cursor-pointer"
                    >
                      <svg
                        className={`w-9 h-9 transition-colors ${star <= rateUsRating ? 'text-accent-500' : 'text-neutral-200'}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRateUsSubmit}
                  disabled={rateUsRating === 0}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-40"
                >
                  Rate Us
                </button>
                <button
                  onClick={handleRateUsDismiss}
                  className="mt-2 text-xs text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
                >
                  Maybe later
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
