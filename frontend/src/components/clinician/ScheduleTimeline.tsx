import type { ScheduleEventItem } from '../../lib/types'

interface ScheduleTimelineProps {
  events: ScheduleEventItem[]
}

export function ScheduleTimeline({ events }: ScheduleTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-400 text-center py-4">No scheduled events</p>
  }

  return (
    <div className="space-y-0">
      {events.map((evt, i) => (
        <div key={evt.id} className="flex gap-3 py-2.5 relative">
          {i < events.length - 1 && (
            <div className="absolute left-[9px] top-8 bottom-0 w-px bg-neutral-200" />
          )}

          <div className={`
            w-[18px] h-[18px] rounded-full flex-shrink-0 mt-0.5
            flex items-center justify-center
            ${evt.status === 'SENT' ? 'bg-success-50' :
              evt.status === 'SKIPPED' ? 'bg-neutral-100' :
              'bg-primary-50'}
          `}>
            <div className={`
              w-2 h-2 rounded-full
              ${evt.status === 'SENT' ? 'bg-success-500' :
                evt.status === 'SKIPPED' ? 'bg-neutral-400' :
                'bg-primary-500'}
            `} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-700">
                {evt.event_type.replace('_', ' ')}
              </span>
              <span className={`
                text-[10px] font-medium px-1.5 py-0.5 rounded
                ${evt.status === 'SENT' ? 'bg-success-50 text-success-600' :
                  evt.status === 'SKIPPED' ? 'bg-neutral-100 text-neutral-500' :
                  'bg-primary-50 text-primary-600'}
              `}>
                {evt.status}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 mt-0.5">
              {new Date(evt.scheduled_at).toLocaleString()}
            </p>
            {evt.message && (
              <p className="text-[11px] text-neutral-500 mt-1">{evt.message}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
