import type { AlertItem } from '../lib/types'

interface AlertCardProps {
  alert: AlertItem
  onAcknowledge: (id: number) => void
}

const urgencyConfig: Record<string, {
  border: string
  badge: string
  icon: string
  dot: string
}> = {
  CRITICAL: {
    border: 'border-l-danger-500',
    badge: 'bg-danger-50 text-danger-600',
    icon: '!',
    dot: 'bg-danger-500',
  },
  HIGH: {
    border: 'border-l-warning-500',
    badge: 'bg-warning-50 text-amber-700',
    icon: '!',
    dot: 'bg-warning-500',
  },
  NORMAL: {
    border: 'border-l-neutral-300',
    badge: 'bg-neutral-100 text-neutral-600',
    icon: 'i',
    dot: 'bg-neutral-400',
  },
}

export function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const config = urgencyConfig[alert.urgency] ?? urgencyConfig.NORMAL
  const isNew = alert.status === 'NEW'

  const time = new Date(alert.created_at).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      data-testid="alert-card"
      className={`
        card
        border-l-4 ${config.border}
        p-4 sm:p-5
        animate-fade-in-up
        ${isNew ? 'bg-white' : 'bg-neutral-50/50 opacity-75'}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Header row: name + badges */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-semibold text-neutral-800">
              {alert.patient_name}
            </span>

            {/* Urgency badge */}
            <span className={`
              inline-flex items-center gap-1
              text-[11px] font-semibold
              px-2.5 py-0.5 rounded-full
              uppercase tracking-wide
              ${config.badge}
            `}>
              <span className={`
                w-1.5 h-1.5 rounded-full
                ${config.dot}
              `} />
              {alert.urgency}
            </span>

            {/* Status badge */}
            <span className={`
              text-[11px] font-semibold
              px-2.5 py-0.5 rounded-full
              uppercase tracking-wide
              ${isNew
                ? 'bg-primary-50 text-primary-700'
                : 'bg-neutral-100 text-neutral-500'
              }
            `}>
              {alert.status}
            </span>
          </div>

          {/* Reason */}
          <p className="text-sm text-neutral-600 leading-relaxed mb-2">
            {alert.reason}
          </p>

          {/* Timestamp */}
          <span className="text-[11px] text-neutral-400">
            {time}
          </span>
        </div>

        {/* Acknowledge button */}
        {isNew && (
          <button
            onClick={() => onAcknowledge(alert.id)}
            className="
              flex-shrink-0
              btn-primary
              px-4 py-2
              text-xs
            "
          >
            Acknowledge
          </button>
        )}

        {/* Acknowledged checkmark */}
        {!isNew && (
          <div className="
            flex-shrink-0
            flex items-center gap-1.5
            text-xs font-medium text-success-600
          ">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden sm:inline">Acknowledged</span>
          </div>
        )}
      </div>
    </div>
  )
}
