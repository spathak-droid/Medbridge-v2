interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
  children: React.ReactNode
  className?: string
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  neutral: 'bg-neutral-100 text-neutral-600',
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span className={`
      inline-flex items-center
      px-2 py-0.5 rounded-full
      text-[11px] font-semibold
      ${variantClasses[variant]}
      ${className}
    `}>
      {children}
    </span>
  )
}
