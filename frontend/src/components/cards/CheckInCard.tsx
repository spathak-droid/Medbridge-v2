import { Badge } from '../ui/Badge'

interface CheckInCardProps {
  eventType: string
  tone?: string
}

export function CheckInCard({ eventType }: CheckInCardProps) {
  const dayMap: Record<string, { label: string; variant: 'primary' | 'success' | 'warning' }> = {
    DAY_2: { label: 'Day 2 Check-in', variant: 'primary' },
    DAY_5: { label: 'Day 5 Check-in', variant: 'success' },
    DAY_7: { label: 'Week 1 Review', variant: 'warning' },
  }

  const info = dayMap[eventType] ?? { label: eventType, variant: 'primary' as const }

  return (
    <div className="flex justify-start mb-2 ml-11">
      <Badge variant={info.variant}>{info.label}</Badge>
    </div>
  )
}
