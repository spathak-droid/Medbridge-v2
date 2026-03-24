export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function adherenceColor(pct: number | null): string {
  if (pct === null) return 'text-neutral-400'
  if (pct >= 80) return 'text-success-600'
  if (pct >= 60) return 'text-accent-600'
  if (pct >= 40) return 'text-warning-500'
  return 'text-danger-600'
}

export function adherenceBgColor(pct: number | null): string {
  if (pct === null) return 'bg-neutral-200'
  if (pct >= 80) return 'bg-success-500'
  if (pct >= 60) return 'bg-accent-500'
  if (pct >= 40) return 'bg-warning-500'
  return 'bg-danger-500'
}

export function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pending',
    ONBOARDING: 'Onboarding',
    ACTIVE: 'Active',
    RE_ENGAGING: 'Re-engaging',
    DORMANT: 'Dormant',
  }
  return map[phase] ?? phase
}

export function phaseColor(phase: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-neutral-100 text-neutral-600',
    ONBOARDING: 'bg-blue-50 text-blue-700',
    ACTIVE: 'bg-emerald-50 text-emerald-700',
    RE_ENGAGING: 'bg-amber-50 text-amber-700',
    DORMANT: 'bg-red-50 text-red-700',
  }
  return map[phase] ?? 'bg-neutral-100 text-neutral-600'
}
