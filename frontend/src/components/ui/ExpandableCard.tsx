import { useState } from 'react'

interface ExpandableCardProps {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
}

export function ExpandableCard({
  title,
  subtitle,
  badge,
  children,
  defaultExpanded = false,
}: ExpandableCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="
          w-full flex items-center justify-between
          px-4 py-3.5
          text-left
          hover:bg-neutral-50
          transition-colors
        "
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-800">{title}</span>
            {badge}
          </div>
          {subtitle && (
            <span className="text-[11px] text-neutral-400 mt-0.5 block">{subtitle}</span>
          )}
        </div>
        <svg
          className={`
            w-4 h-4 text-neutral-400
            transition-transform duration-200
            ${expanded ? 'rotate-180' : ''}
          `}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}
