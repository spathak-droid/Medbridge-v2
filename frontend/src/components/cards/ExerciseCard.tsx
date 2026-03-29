import { useState, useEffect, useRef } from 'react'
import type { Exercise } from '../../lib/types'
import { Badge } from '../ui/Badge'

// Load YouTube IFrame API once globally
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

interface ExerciseCardProps {
  exercise: Exercise
  completionPct?: number
  isCompletedToday?: boolean
  onToggleComplete?: (exerciseId: string) => void
  isLogging?: boolean
  videoWatchPct?: number

  onVideoProgress?: (exerciseId: string, percentage: number) => void
}

// Muscle group to emoji icon mapping for visual flair
const MUSCLE_ICONS: Record<string, string> = {
  quadriceps: '\u{1F9B5}',
  hamstrings: '\u{1F9B5}',
  calves: '\u{1F9B5}',
  glutes: '\u{1F3CB}',
  core: '\u{1F4AA}',
  abdominals: '\u{1F4AA}',
  'hip flexors': '\u{1F9B5}',
  'hip stabilizers': '\u{1F9B5}',
  ankles: '\u{1F9B6}',
  legs: '\u{1F9B5}',
  'rotator cuff': '\u{1F933}',
  deltoids: '\u{1F933}',
  trapezius: '\u{1F933}',
  rhomboids: '\u{1F933}',
  'posterior deltoid': '\u{1F933}',
  infraspinatus: '\u{1F933}',
  'erector spinae': '\u{1F4AA}',
  'pelvic floor': '\u{1F4AA}',
  'tibialis anterior': '\u{1F9B6}',
}

function getExerciseIcon(muscleGroups: string[]): string {
  for (const mg of muscleGroups) {
    const icon = MUSCLE_ICONS[mg.toLowerCase()]
    if (icon) return icon
  }
  return '\u{1F3CB}'
}

export function ExerciseCard({
  exercise,
  completionPct,
  isCompletedToday,
  onToggleComplete,
  isLogging,
  videoWatchPct,

  onVideoProgress,
}: ExerciseCardProps) {
  const [expanded, setExpanded] = useState(false)

  const playerRef = useRef<any>(null)
  const playerContainerRef = useRef<string>(`yt-player-${exercise.id}`)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxWatchPctRef = useRef(videoWatchPct ?? 0)

  useEffect(() => {
    maxWatchPctRef.current = Math.max(maxWatchPctRef.current, videoWatchPct ?? 0)
  }, [videoWatchPct])

  useEffect(() => {
    if (!expanded || !exercise.video_id) return

    let player: any = null

    loadYouTubeApi().then(() => {
      if (!expanded) return
      player = new (window as any).YT.Player(playerContainerRef.current, {
        videoId: exercise.video_id,
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
              if (onVideoProgress && maxWatchPctRef.current > 0) {
                onVideoProgress(exercise.id, maxWatchPctRef.current)
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
      if (onVideoProgress && maxWatchPctRef.current > (videoWatchPct ?? 0)) {
        onVideoProgress(exercise.id, maxWatchPctRef.current)
      }
      if (playerRef.current?.destroy) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [expanded, exercise.video_id])

  return (
    <div
      className={`card overflow-hidden transition-all duration-200 ${
        isCompletedToday ? 'ring-1 ring-success-200 bg-success-50/30' : ''
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Checkbox / completion toggle */}
        {onToggleComplete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete(exercise.id)
            }}
            disabled={isLogging}
            className={`
              flex-shrink-0 w-8 h-8 rounded-full border-2 mt-0.5
              flex items-center justify-center
              transition-all duration-200
              cursor-pointer
              ${isLogging ? 'opacity-50 animate-pulse' : ''}
              ${isCompletedToday
                ? 'bg-success-500 border-success-500 text-white shadow-sm'
                : 'border-neutral-300 hover:border-primary-400 text-transparent hover:text-primary-300'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </button>
        )}

        {/* Exercise illustration area */}
        <div className={`
          flex-shrink-0 w-12 h-12 rounded-xl
          flex items-center justify-center text-xl
          ${isCompletedToday
            ? 'bg-success-100'
            : 'bg-gradient-to-br from-primary-50 to-primary-100'
          }
        `}>
          {getExerciseIcon(exercise.muscle_groups)}
        </div>

        {/* Exercise info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${isCompletedToday ? 'text-success-700' : 'text-neutral-800'}`}>
              {exercise.name}
            </span>
            {exercise.difficulty === 'intermediate' ? (
              <Badge variant="warning">Intermediate</Badge>
            ) : (
              <Badge variant="success">Beginner</Badge>
            )}
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-neutral-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              {exercise.sets} x {exercise.reps}
            </span>
            {exercise.hold_time_seconds > 0 && (
              <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Hold {exercise.hold_time_seconds}s
              </span>
            )}
            <span className="text-[11px] text-neutral-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              {exercise.frequency}
            </span>
          </div>
        </div>

        {/* Completion percentage */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {exercise.video_id && (
            <div className={`flex items-center gap-1 ${
              (videoWatchPct ?? 0) >= 80 ? 'text-success-500' : 'text-neutral-300'
            }`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {(videoWatchPct ?? 0) >= 80 && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
          )}
          {completionPct !== undefined && (
            <span className={`text-sm font-bold ${
              completionPct >= 80 ? 'text-success-600' :
              completionPct >= 60 ? 'text-accent-500' :
              'text-warning-500'
            }`}>
              {completionPct.toFixed(0)}%
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-0.5"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable instructions section */}
      <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-[600px]' : 'max-h-0'}`}>
        <div className="px-4 pb-3 border-t border-neutral-100 pt-3">
          {/* How to do it */}
          <div className="mb-3">
            <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">How to do it</h4>
            <p className="text-xs text-neutral-600 leading-relaxed">{exercise.description}</p>
          </div>

          {/* Tips */}
          {exercise.tips && (
            <div className="mb-3 bg-primary-50/60 rounded-lg p-2.5 border border-primary-100">
              <h4 className="text-[10px] font-bold text-primary-700 uppercase tracking-wider mb-1">Pro Tips</h4>
              <p className="text-xs text-neutral-700 leading-relaxed">{exercise.tips}</p>
            </div>
          )}

          {/* Precautions */}
          {exercise.precautions && (
            <div className="mb-3 bg-amber-50 rounded-lg p-2.5 border border-amber-100">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs">⚠️</span>
                <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Safety</h4>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">{exercise.precautions}</p>
            </div>
          )}

          {/* Quick reference */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-neutral-50 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-neutral-800">{exercise.sets}</div>
              <div className="text-[10px] text-neutral-400">Sets</div>
            </div>
            <div className="bg-neutral-50 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-neutral-800">{exercise.reps}</div>
              <div className="text-[10px] text-neutral-400">Reps</div>
            </div>
            <div className="bg-neutral-50 rounded-lg p-2 text-center">
              <div className="text-sm font-bold text-neutral-800">
                {exercise.hold_time_seconds > 0 ? `${exercise.hold_time_seconds}s` : '--'}
              </div>
              <div className="text-[10px] text-neutral-400">Hold</div>
            </div>
          </div>

          {/* Embedded video player */}
          {exercise.video_id && (
            <div className="mb-3">
              <div className="relative w-full rounded-lg overflow-hidden bg-neutral-900" style={{ paddingBottom: '56.25%' }}>
                <div
                  id={playerContainerRef.current}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      (videoWatchPct ?? 0) >= 80 ? 'bg-success-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(videoWatchPct ?? 0, 100)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${
                  (videoWatchPct ?? 0) >= 80 ? 'text-success-600' : 'text-neutral-400'
                }`}>
                  {(videoWatchPct ?? 0) >= 80 ? 'Watched' : `${Math.round(videoWatchPct ?? 0)}%`}
                </span>
              </div>
            </div>
          )}
          {/* Fallback: external link if no video_id but has video_url */}
          {!exercise.video_id && exercise.video_url && (
            <a href={exercise.video_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 p-2.5 mb-3 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors group">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center group-hover:bg-red-600 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-neutral-800 truncate">{exercise.video_title || 'Watch Video Guide'}</p>
                <p className="text-[10px] text-neutral-400">Watch on YouTube</p>
              </div>
            </a>
          )}

          {/* Muscle groups */}
          <div className="flex flex-wrap gap-1.5">
            {exercise.muscle_groups.map((mg) => (
              <span
                key={mg}
                className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-[10px] font-medium"
              >
                {MUSCLE_ICONS[mg.toLowerCase()] || ''} {mg}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Compact description (visible when collapsed) */}
      {!expanded && (
        <div className="px-4 pb-3 pt-0">
          <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{exercise.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {exercise.muscle_groups.map((mg) => (
              <span
                key={mg}
                className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-[10px] font-medium"
              >
                {mg}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress bar */}
      {completionPct !== undefined && (
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completionPct >= 80 ? 'bg-success-500' :
                completionPct >= 60 ? 'bg-accent-500' :
                'bg-warning-500'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
