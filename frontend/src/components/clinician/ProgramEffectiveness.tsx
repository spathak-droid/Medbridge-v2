import { Link } from 'react-router-dom'
import type { ProgramStat, ProgramOutlier } from '../../lib/types'
import { adherenceColor } from '../../lib/utils'

interface ProgramEffectivenessProps {
  programs: ProgramStat[]
  outliers: ProgramOutlier[]
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-400'
  if (pct >= 60) return 'bg-amber-400'
  if (pct >= 40) return 'bg-orange-400'
  return 'bg-red-400'
}

export function ProgramEffectiveness({ programs, outliers }: ProgramEffectivenessProps) {
  if (programs.length === 0) {
    return (
      <p className="text-sm text-neutral-400 text-center py-4">
        No programs assigned yet
      </p>
    )
  }

  return (
    <div>
      <div className="space-y-3">
        {programs.map((prog) => (
          <div key={prog.program_type}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-neutral-700 font-medium truncate">
                {prog.program_name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-neutral-400">
                  {prog.patient_count} patient{prog.patient_count !== 1 ? 's' : ''}
                </span>
                <span className={`text-sm font-semibold ${adherenceColor(prog.avg_adherence)}`}>
                  {Math.round(prog.avg_adherence)}%
                </span>
              </div>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(prog.avg_adherence)}`}
                style={{ width: `${Math.min(100, prog.avg_adherence)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {outliers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Outliers
          </h4>
          <div className="space-y-1.5">
            {outliers.map((o) => (
              <Link
                key={o.patient_id}
                to={`/dashboard/patient/${o.patient_id}`}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-neutral-50 transition-colors"
              >
                <span className="text-xs text-neutral-700">{o.name}</span>
                <span className="text-xs">
                  <span className={`font-semibold ${adherenceColor(o.adherence_pct)}`}>
                    {Math.round(o.adherence_pct)}%
                  </span>
                  <span className="text-neutral-400 ml-1">
                    (avg {Math.round(o.program_avg)}%)
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
