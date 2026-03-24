import { phaseColor, phaseLabel } from '../../lib/utils'

interface PhaseBadgeProps {
  phase: string
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  return (
    <span className={`
      inline-flex items-center
      px-2 py-0.5 rounded-full
      text-[11px] font-semibold
      ${phaseColor(phase)}
    `}>
      {phase === 'DORMANT' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />}
      {phaseLabel(phase)}
    </span>
  )
}
