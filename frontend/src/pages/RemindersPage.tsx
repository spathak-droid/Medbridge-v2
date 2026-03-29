import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { usePatient } from '../hooks/usePatient'
import { getSchedule } from '../lib/api'
import type { ScheduleEventItem } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

interface EventMeta {
  label: string
  iconColor: string
  iconBg: string
  icon: JSX.Element
}

const BELL_ICON = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
const MAIL_ICON = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
const CHART_ICON = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
const CHECK_ICON = <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>

function getEventMeta(type: string): EventMeta {
  switch (type) {
    case 'REMINDER':
      return { label: 'Reminder', iconColor: 'text-amber-500', iconBg: 'bg-amber-50', icon: BELL_ICON }
    case 'DAY_2':
      return { label: 'Day 2 Check-in', iconColor: 'text-primary-500', iconBg: 'bg-primary-50', icon: MAIL_ICON }
    case 'DAY_5':
      return { label: 'Day 5 Check-in', iconColor: 'text-primary-500', iconBg: 'bg-primary-50', icon: MAIL_ICON }
    case 'DAY_7':
      return { label: 'Day 7 Check-in', iconColor: 'text-primary-500', iconBg: 'bg-primary-50', icon: MAIL_ICON }
    case 'WEEKLY_DIGEST':
      return { label: 'Weekly Digest', iconColor: 'text-violet-500', iconBg: 'bg-violet-50', icon: CHART_ICON }
    default:
      return { label: type.replace(/_/g, ' '), iconColor: 'text-neutral-400', iconBg: 'bg-neutral-100', icon: BELL_ICON }
  }
}

function formatRelative(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function RemindersPage() {
  const { patientId } = usePatient()
  const navigate = useNavigate()
  const [events, setEvents] = useState<ScheduleEventItem[]>([])
  const [loading, setLoading] = useState(true)

  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    getSchedule(patientId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    if (loading || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-reminder]')
    gsap.fromTo(items, { opacity: 0, x: -20 }, {
      opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: 'power3.out',
    })
  }, [loading])

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

  const delivered = events
    .filter((e) => e.status === 'SENT')
    .sort((a, b) => new Date(b.executed_at || b.scheduled_at).getTime() - new Date(a.executed_at || a.scheduled_at).getTime())

  const hasNothing = upcoming.length === 0 && delivered.length === 0

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">Reminders</h1>
          <p className="text-sm text-neutral-400 mt-0.5">Scheduled check-ins and notifications</p>
        </div>
        <button
          onClick={() => navigate('/chat')}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Reminder
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary-500">{upcoming.length}</p>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">Upcoming</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-success-600">{delivered.length}</p>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">Delivered</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">{events.length}</p>
          <p className="text-[11px] text-neutral-400 font-medium mt-0.5">Total</p>
        </div>
      </div>

      <div ref={listRef}>
        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">
              Upcoming
            </h3>
            <div className="space-y-3">
              {upcoming.map((e) => {
                const meta = getEventMeta(e.event_type)
                const date = new Date(e.scheduled_at)
                return (
                  <div key={e.id} data-reminder className="card p-4 flex items-start gap-4 border-l-4 border-primary-400">
                    <div className={`w-11 h-11 rounded-xl ${meta.iconBg} flex items-center justify-center flex-shrink-0 ${meta.iconColor}`}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-neutral-800">{meta.label}</span>
                        <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
                          {formatRelative(date)}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at{' '}
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {e.message && (
                        <p className="text-sm text-neutral-600 mt-2 bg-neutral-50 rounded-lg p-3 leading-relaxed">
                          {e.message}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Delivered */}
        {delivered.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4">
              Delivered
            </h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[21px] top-0 bottom-0 w-px bg-neutral-200" />

              <div className="space-y-4">
                {delivered.map((e) => {
                  const meta = getEventMeta(e.event_type)
                  const date = new Date(e.executed_at || e.scheduled_at)
                  return (
                    <div key={e.id} data-reminder className="flex items-start gap-4 relative">
                      {/* Timeline dot */}
                      <div className="w-[43px] flex items-center justify-center flex-shrink-0 z-10">
                        <div className="w-3 h-3 rounded-full bg-success-500 ring-4 ring-white" />
                      </div>
                      <div className="flex-1 min-w-0 pb-4">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-neutral-700">{meta.label}</span>
                          <span className="text-[10px] font-medium text-success-600">Delivered</span>
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at{' '}
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {e.message && (
                          <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">{e.message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {hasNothing && (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">No Reminders Yet</h3>
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed max-w-sm mx-auto">
            Ask your AI coach to set reminders for exercises, appointments, or anything else.
          </p>
          <button
            onClick={() => navigate('/chat')}
            className="btn-primary px-6 py-3 text-sm"
          >
            Talk to AI Coach
          </button>
        </div>
      )}
    </div>
  )
}
