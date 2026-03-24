import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import { getSchedule } from '../lib/api'
import type { ScheduleEventItem } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

const EVENT_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  REMINDER: { icon: '\u23F0', label: 'Reminder', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  DAY_2: { icon: '\u{1F4EC}', label: 'Day 2 Check-in', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  DAY_5: { icon: '\u{1F4EC}', label: 'Day 5 Check-in', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  DAY_7: { icon: '\u{1F4EC}', label: 'Day 7 Check-in', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  WEEKLY_DIGEST: { icon: '\u{1F4CA}', label: 'Weekly Digest', color: 'bg-purple-50 border-purple-200 text-purple-800' },
}

function getEventMeta(type: string) {
  return EVENT_LABELS[type] ?? { icon: '\u{1F514}', label: type, color: 'bg-neutral-50 border-neutral-200 text-neutral-700' }
}

export function RemindersPage() {
  const { patientId } = usePatient()
  const navigate = useNavigate()
  const [events, setEvents] = useState<ScheduleEventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    getSchedule(patientId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  const upcoming = events
    .filter((e) => e.status === 'PENDING')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const completed = events
    .filter((e) => e.status === 'SENT' && e.message)
    .sort((a, b) => new Date(b.executed_at || b.scheduled_at).getTime() - new Date(a.executed_at || a.scheduled_at).getTime())

  const skipped = events.filter((e) => e.status === 'SKIPPED')

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-neutral-800">Reminders & Check-ins</h2>
        <button
          onClick={() => navigate('/')}
          className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ask AI to set one
        </button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Upcoming ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.map((e) => {
              const meta = getEventMeta(e.event_type)
              const date = new Date(e.scheduled_at)
              const now = new Date()
              const diffMs = date.getTime() - now.getTime()
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
              const timeLabel =
                diffDays <= 0 ? 'Today' :
                diffDays === 1 ? 'Tomorrow' :
                diffDays <= 7 ? `In ${diffDays} days` :
                date.toLocaleDateString()

              return (
                <div key={e.id} className={`card p-4 border-l-4 ${meta.color}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-neutral-800">{meta.label}</span>
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                          {timeLabel}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {e.message && (
                        <p className="text-xs text-neutral-700 mt-1.5 bg-white/60 rounded-lg p-2 border border-neutral-100">
                          {e.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Delivered ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map((e) => {
              const meta = getEventMeta(e.event_type)
              const date = new Date(e.executed_at || e.scheduled_at)
              return (
                <div key={e.id} className="card p-3 opacity-80">
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-neutral-600">{meta.label}</span>
                        <span className="text-[10px] text-success-600 font-medium">Delivered</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">
                        {date.toLocaleDateString()} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {e.message && (
                        <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{e.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {upcoming.length === 0 && completed.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">{'\u{1F514}'}</div>
          <h3 className="text-lg font-semibold text-neutral-700 mb-1">No Reminders Yet</h3>
          <p className="text-sm text-neutral-400 mb-4">
            Ask your AI coach to set reminders for exercises, appointments, or anything else.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary px-5 py-2 text-sm inline-flex items-center gap-2"
          >
            Talk to AI Coach
          </button>
        </div>
      )}
    </div>
  )
}
