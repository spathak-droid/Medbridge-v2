import { Link } from 'react-router-dom'
import type { AttentionPatient } from '../../lib/types'
import { adherenceColor } from '../../lib/utils'
import { RiskBadge } from './RiskBadge'

interface AttentionListProps {
  patients: AttentionPatient[]
}

function TrendArrow({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
  if (trend === 'improving') {
    return <span className="text-success-600 text-xs" title="Improving">&#9650;</span>
  }
  if (trend === 'declining') {
    return <span className="text-danger-600 text-xs" title="Declining">&#9660;</span>
  }
  return <span className="text-neutral-400 text-xs" title="Stable">&#9654;</span>
}

export function AttentionList({ patients }: AttentionListProps) {
  if (patients.length === 0) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
        <p className="text-emerald-700 font-medium text-sm">All patients on track</p>
        <p className="text-emerald-600 text-xs mt-1">No patients with elevated risk scores</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {patients.map((p) => (
        <Link
          key={p.patient_id}
          to={`/dashboard/patient/${p.patient_id}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-50 transition-colors group"
        >
          {/* Name + risk badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-neutral-800 truncate group-hover:text-primary-700 transition-colors">
                {p.name}
              </span>
              <RiskBadge level={p.risk_level} score={p.risk_score} />
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{p.top_risk_factor}</p>
          </div>

          {/* Adherence + trend */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-sm font-semibold ${adherenceColor(p.adherence_pct)}`}>
              {p.adherence_pct !== null ? `${Math.round(p.adherence_pct)}%` : '--'}
            </span>
            <TrendArrow trend={p.adherence_trend} />
          </div>
        </Link>
      ))}
    </div>
  )
}
