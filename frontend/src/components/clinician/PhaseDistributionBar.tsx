import { phaseLabel } from '../../lib/utils'

interface PhaseDistributionBarProps {
  distribution: Record<string, number>
  total: number
}

const phaseColors: Record<string, string> = {
  PENDING: 'bg-neutral-300',
  ONBOARDING: 'bg-blue-400',
  ACTIVE: 'bg-emerald-500',
  RE_ENGAGING: 'bg-amber-400',
  DORMANT: 'bg-red-400',
}

export function PhaseDistributionBar({ distribution, total }: PhaseDistributionBarProps) {
  if (total === 0) return null

  const phases = ['PENDING', 'ONBOARDING', 'ACTIVE', 'RE_ENGAGING', 'DORMANT']

  return (
    <div>
      {/* Bar */}
      <div className="flex h-6 rounded-full overflow-hidden">
        {phases.map((phase) => {
          const count = distribution[phase] ?? 0
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={phase}
              className={`${phaseColors[phase]} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${phaseLabel(phase)}: ${count}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {phases.map((phase) => {
          const count = distribution[phase] ?? 0
          if (count === 0) return null
          return (
            <div key={phase} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${phaseColors[phase]}`} />
              <span className="text-[11px] text-neutral-500">
                {phaseLabel(phase)} ({count})
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
