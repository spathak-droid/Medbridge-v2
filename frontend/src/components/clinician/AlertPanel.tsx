import { useState } from 'react'
import type { AlertItem } from '../../lib/types'
import { formatRelativeTime } from '../../lib/utils'

interface AlertPanelProps {
  alerts: AlertItem[]
  onAcknowledge: (id: number) => void
}

export function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (alerts.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✅</div>
        <p className="text-sm text-neutral-500">No active alerts</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.urgency === 'CRITICAL'
        const isHigh = alert.urgency === 'HIGH'
        const isNew = alert.status === 'NEW'

        return (
          <div
            key={alert.id}
            className={`
              card overflow-hidden
              ${isCritical && isNew ? 'ring-2 ring-red-300 animate-pulse-soft' : ''}
            `}
          >
            <button
              className="w-full px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
              onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
            >
              <div className="flex items-center gap-3">
                {/* Urgency dot */}
                <div className={`
                  w-2.5 h-2.5 rounded-full flex-shrink-0
                  ${isCritical ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-blue-400'}
                `} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800 truncate">
                      {alert.patient_name}
                    </span>
                    <span className={`
                      px-1.5 py-0.5 rounded text-[10px] font-bold
                      ${isCritical ? 'bg-red-100 text-red-700' :
                        isHigh ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-50 text-blue-600'}
                    `}>
                      {alert.urgency}
                    </span>
                    {!isNew && (
                      <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-medium">
                        ACK
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">{alert.reason}</p>
                </div>
                <span className="text-[10px] text-neutral-300 flex-shrink-0">
                  {formatRelativeTime(alert.created_at)}
                </span>
              </div>
            </button>

            {expandedId === alert.id && (
              <div className="px-4 pb-3 border-t border-neutral-100 pt-3 animate-fade-in">
                <p className="text-sm text-neutral-600 leading-relaxed mb-3">{alert.reason}</p>
                {isNew && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="btn-primary px-4 py-1.5 text-xs"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
