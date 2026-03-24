interface RiskBadgeProps {
  level: string
  score?: number
}

const RISK_CONFIG: Record<string, { bg: string; text: string; label: string; pulse?: boolean }> = {
  LOW: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  CRITICAL: { bg: 'bg-red-200', text: 'text-red-800', label: 'Critical', pulse: true },
}

export function RiskBadge({ level, score }: RiskBadgeProps) {
  const config = RISK_CONFIG[level] ?? RISK_CONFIG.LOW

  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-1.5 py-0.5 rounded-full
        text-[10px] font-semibold
        ${config.bg} ${config.text}
        ${config.pulse ? 'animate-pulse' : ''}
      `}
      title={score !== undefined ? `Risk score: ${score}/100` : undefined}
    >
      {config.pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      )}
      {config.label}
    </span>
  )
}
