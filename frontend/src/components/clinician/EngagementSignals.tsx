import { Link } from 'react-router-dom'
import type { SilentPatient, UnansweredPatient, MilestoneEvent } from '../../lib/types'
import { formatRelativeTime } from '../../lib/utils'

interface EngagementSignalsProps {
  silentPatients: SilentPatient[]
  unansweredPatients: UnansweredPatient[]
  milestones: MilestoneEvent[]
}

const MILESTONE_CONFIG: Record<string, { color: string; icon: string }> = {
  goal_confirmed: { color: 'bg-emerald-400', icon: 'G' },
  phase_change: { color: 'bg-blue-400', icon: 'P' },
  alert_generated: { color: 'bg-red-400', icon: 'A' },
  streak_milestone: { color: 'bg-green-500', icon: 'S' },
  adherence_milestone: { color: 'bg-blue-500', icon: 'A' },
}

export function EngagementSignals({ silentPatients, unansweredPatients, milestones }: EngagementSignalsProps) {
  return (
    <div className="space-y-5">
      {/* Silent patients */}
      <div>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Silent patients
          {silentPatients.length > 0 && (
            <span className="ml-1.5 text-danger-600 normal-case font-medium">
              ({silentPatients.length})
            </span>
          )}
        </h4>
        {silentPatients.length === 0 ? (
          <p className="text-xs text-neutral-400">All patients active recently</p>
        ) : (
          <div className="space-y-1">
            {silentPatients.slice(0, 5).map((p) => (
              <Link
                key={p.patient_id}
                to={`/dashboard/patient/${p.patient_id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs text-neutral-700">{p.name}</span>
                <span className="text-xs text-neutral-400">
                  {p.days_silent >= 999 ? 'Never contacted' : `${p.days_silent}d silent`}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Unanswered */}
      <div>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Unanswered
          {unansweredPatients.length > 0 && (
            <span className="ml-1.5 text-warning-500 normal-case font-medium">
              ({unansweredPatients.length})
            </span>
          )}
        </h4>
        {unansweredPatients.length === 0 ? (
          <p className="text-xs text-neutral-400">All messages answered</p>
        ) : (
          <div className="space-y-1">
            {unansweredPatients.map((p) => (
              <Link
                key={p.patient_id}
                to={`/dashboard/patient/${p.patient_id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs text-neutral-700">{p.name}</span>
                <span className="text-xs text-amber-600 font-medium">
                  {p.unanswered_count} unanswered
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent milestones */}
      <div>
        <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Recent milestones
        </h4>
        {milestones.length === 0 ? (
          <p className="text-xs text-neutral-400">No recent events</p>
        ) : (
          <div className="space-y-2">
            {milestones.map((m, i) => {
              const config = MILESTONE_CONFIG[m.event_type] ?? MILESTONE_CONFIG.alert_generated
              return (
                <div key={`${m.event_type}-${m.patient_id}-${i}`} className="flex items-start gap-2">
                  <div className={`w-5 h-5 rounded-full ${config.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="text-white text-[9px] font-bold">{config.icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-700 leading-snug">
                      <span className="font-medium">{m.patient_name}</span>
                      {' — '}
                      {m.description}
                    </p>
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      {formatRelativeTime(m.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
