interface MetricCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}

export function MetricCard({ label, value, icon, trend, color = 'text-neutral-800' }: MetricCardProps) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        {icon && (
          <div className="text-2xl">{icon}</div>
        )}
      </div>
      {trend && trend !== 'neutral' && (
        <div className={`flex items-center gap-1 mt-2 text-[11px] font-medium ${trend === 'up' ? 'text-success-600' : 'text-danger-600'}`}>
          <svg className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
          {trend === 'up' ? 'Improving' : 'Declining'}
        </div>
      )}
    </div>
  )
}
