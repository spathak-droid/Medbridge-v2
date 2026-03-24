import { Link } from 'react-router-dom'
import type { PatientSummary, RiskAssessment } from '../../lib/types'
import { adherenceColor } from '../../lib/utils'
import { PhaseBadge } from './PhaseBadge'
import { RiskBadge } from './RiskBadge'

interface PatientRosterProps {
  patients: PatientSummary[]
  riskScores?: Record<number, RiskAssessment>
}

export function PatientRoster({ patients, riskScores = {} }: PatientRosterProps) {
  return (
    <div className="space-y-2">
      {patients.map((p) => (
        <Link
          key={p.id}
          to={`/dashboard/patient/${p.id}`}
          className="
            card flex items-center gap-4
            px-4 py-3.5
            hover:shadow-card-hover
            transition-all duration-200
          "
        >
          {/* Avatar */}
          <div className="
            flex-shrink-0
            w-10 h-10 rounded-full
            bg-gradient-to-br from-primary-400 to-primary-600
            flex items-center justify-center
            text-white text-sm font-bold
          ">
            {p.name.split(' ').map(n => n[0]).join('')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-neutral-800 truncate">{p.name}</span>
              <PhaseBadge phase={p.phase} />
              {riskScores[p.id] && (
                <RiskBadge
                  level={riskScores[p.id].risk_level}
                  score={riskScores[p.id].risk_score}
                />
              )}
            </div>
            {p.goal_summary && (
              <p className="text-[11px] text-neutral-400 truncate mt-0.5">{p.goal_summary}</p>
            )}
          </div>

          {/* Adherence */}
          <div className="text-right flex-shrink-0">
            {p.adherence_pct !== null ? (
              <span className={`text-sm font-bold ${adherenceColor(p.adherence_pct)}`}>
                {p.adherence_pct}%
              </span>
            ) : (
              <span className="text-xs text-neutral-300">--</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
