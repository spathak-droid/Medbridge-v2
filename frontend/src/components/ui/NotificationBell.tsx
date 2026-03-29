import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { getUnreadCount, getSchedule, getDirectMessages, markAllRead } from '../../lib/api'
import type { ScheduleEventItem, DirectMessage } from '../../lib/types'

interface NotificationItem {
  id: string
  type: 'message' | 'reminder' | 'alert'
  title: string
  description: string
  time: string
  rawTime: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const typeIcons: Record<NotificationItem['type'], { icon: JSX.Element; bg: string }> = {
  message: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    bg: 'bg-primary-100 text-primary-600',
  },
  reminder: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    bg: 'bg-amber-100 text-amber-600',
  },
  alert: {
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    bg: 'bg-red-100 text-red-600',
  },
}

interface NotificationBellProps {
  patientId?: number
}

export function NotificationBell({ patientId }: NotificationBellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markedRead, setMarkedRead] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    try {
      const items: NotificationItem[] = []

      const [countRes, schedule, messages] = await Promise.allSettled([
        getUnreadCount(patientId),
        getSchedule(patientId),
        getDirectMessages(patientId),
      ])

      // Unread message count
      let msgCount = 0
      if (countRes.status === 'fulfilled') {
        msgCount = countRes.value.count
        setUnreadCount(markedRead ? 0 : msgCount)
      }

      // Recent messages as notifications
      if (messages.status === 'fulfilled') {
        const recent = messages.value
          .filter((m: DirectMessage) => m.sender_role === 'clinician')
          .slice(-5)
          .reverse()
        for (const msg of recent) {
          items.push({
            id: `msg-${msg.id}`,
            type: 'message',
            title: 'New message from clinician',
            description: msg.content.length > 60 ? msg.content.slice(0, 60) + '...' : msg.content,
            time: relativeTime(msg.created_at),
            rawTime: new Date(msg.created_at).getTime(),
          })
        }
      }

      // Upcoming reminders
      if (schedule.status === 'fulfilled') {
        const upcoming = schedule.value
          .filter((e: ScheduleEventItem) => e.status === 'pending')
          .slice(0, 5)
        for (const evt of upcoming) {
          items.push({
            id: `rem-${evt.id}`,
            type: 'reminder',
            title: 'Upcoming reminder',
            description: evt.message || evt.event_type,
            time: relativeTime(evt.scheduled_at),
            rawTime: new Date(evt.scheduled_at).getTime(),
          })
        }
      }

      // If no real data, show a helpful empty state
      items.sort((a, b) => b.rawTime - a.rawTime)
      setNotifications(items)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [patientId, markedRead])

  // Fetch on mount and periodically
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Animate dropdown open
  useEffect(() => {
    if (open && panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: -8, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power3.out' }
      )
    }
  }, [open])

  // Click outside to close
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleMarkAllRead = async () => {
    if (patientId) {
      try {
        await markAllRead(patientId)
      } catch {
        // still clear locally
      }
    }
    setMarkedRead(true)
    setUnreadCount(0)
    setNotifications([])
  }

  const displayCount = markedRead ? 0 : unreadCount

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="
          relative
          w-10 h-10 rounded-full
          bg-white shadow-float
          flex items-center justify-center
          text-neutral-500 hover:text-primary-600
          transition-colors cursor-pointer
          border border-neutral-200/60
        "
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {displayCount > 0 && (
          <span className="
            absolute -top-1 -right-1
            min-w-[18px] h-[18px] px-1
            rounded-full
            bg-red-500 text-white
            text-[10px] font-bold
            flex items-center justify-center
            leading-none
          ">
            {displayCount > 99 ? '99+' : displayCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="
            absolute right-0 top-12
            w-80 sm:w-96
            bg-white rounded-2xl
            shadow-float
            border border-neutral-200/60
            overflow-hidden
            z-50
          "
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-800">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-400">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-neutral-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <p className="text-sm text-neutral-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((item) => {
                const { icon, bg } = typeIcons[item.type]
                const dest = item.type === 'message' ? '/messages' : '/reminders'
                return (
                  <button
                    key={item.id}
                    onClick={() => { setOpen(false); navigate(dest) }}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-primary-50 transition-colors border-b border-neutral-50 last:border-b-0 w-full text-left cursor-pointer"
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 leading-snug">{item.title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">{item.description}</p>
                    </div>
                    <span className="flex-shrink-0 text-[10px] text-neutral-400 mt-0.5">{item.time}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-neutral-100 px-4 py-2.5 text-center">
              <button
                onClick={() => { setOpen(false); navigate('/messages') }}
                className="text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors cursor-pointer"
              >
                View all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
