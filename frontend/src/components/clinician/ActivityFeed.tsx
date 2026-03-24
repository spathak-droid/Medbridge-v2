import type { ActivityFeedItem } from '../../lib/types'
import { formatRelativeTime } from '../../lib/utils'

interface ActivityFeedProps {
  items: ActivityFeedItem[]
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-400 text-center py-4">No recent activity</p>
  }

  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={item.id} className="flex gap-3 py-3 relative">
          {/* Timeline line */}
          {i < items.length - 1 && (
            <div className="absolute left-[11px] top-10 bottom-0 w-px bg-neutral-200" />
          )}

          {/* Dot */}
          <div className={`
            w-[22px] h-[22px] rounded-full flex-shrink-0
            flex items-center justify-center mt-0.5
            ${item.event_type === 'coach_message'
              ? 'bg-primary-100'
              : 'bg-neutral-100'
            }
          `}>
            <div className={`
              w-2 h-2 rounded-full
              ${item.event_type === 'coach_message'
                ? 'bg-primary-500'
                : 'bg-neutral-400'
              }
            `} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-700">{item.patient_name}</span>
              <span className="text-[10px] text-neutral-300">{formatRelativeTime(item.timestamp)}</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-2">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
