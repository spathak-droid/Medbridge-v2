import { useEffect, useState } from 'react'
import { getAdherence, getProgram } from '../../lib/api'
import type { AdherenceSummary, ProgramSummary } from '../../lib/types'
import { LoadingSkeleton } from '../ui/LoadingSkeleton'

interface Props {
  patientId: number
}

export function ProgramCompletionView({ patientId }: Props) {
  const [program, setProgram] = useState<ProgramSummary | null>(null)
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getProgram(patientId), getAdherence(patientId)])
      .then(([prog, adh]) => {
        setProgram(prog)
        setAdherence(adh)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <LoadingSkeleton variant="card" count={2} />

  if (!program) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm text-neutral-500">No program assigned</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Program header */}
      <div>
        <h4 className="text-sm font-semibold text-neutral-800">{program.program_name}</h4>
        <p className="text-[11px] text-neutral-400 mt-0.5">
          {program.duration_weeks} weeks | {program.exercises.length} exercises | Started {new Date(program.start_date).toLocaleDateString()}
        </p>
      </div>

      {/* Per-exercise completion */}
      <div className="space-y-2.5">
        {program.exercises.map((ex) => {
          const stats = adherence?.per_exercise?.[ex.id]
          const pct = stats?.pct ?? 0

          return (
            <div key={ex.id} className="bg-neutral-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-neutral-700">{ex.name}</span>
                  <span className="text-[10px] text-neutral-400 ml-2">
                    {ex.sets}x{ex.reps} | {ex.frequency}
                  </span>
                </div>
                <span className={`text-xs font-bold flex-shrink-0 ${
                  pct >= 80 ? 'text-success-600' :
                  pct >= 60 ? 'text-accent-500' :
                  pct > 0 ? 'text-warning-500' :
                  'text-neutral-300'
                }`}>
                  {stats ? `${stats.completed}/${stats.total}` : '--'}
                </span>
              </div>
              <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pct >= 80 ? 'bg-success-500' :
                    pct >= 60 ? 'bg-accent-500' :
                    pct > 0 ? 'bg-warning-500' :
                    'bg-neutral-300'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Weekly breakdown */}
      {adherence && adherence.weekly_breakdown.length > 1 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Weekly Breakdown</h4>
          <div className="flex gap-2">
            {adherence.weekly_breakdown.map((w) => {
              const pct = w.total > 0 ? (w.completed / w.total) * 100 : 0
              return (
                <div key={w.week} className="flex-1 text-center">
                  <div className="text-[10px] text-neutral-400 mb-1">Wk {w.week}</div>
                  <div className="h-12 bg-neutral-100 rounded relative overflow-hidden">
                    <div
                      className={`absolute bottom-0 w-full rounded transition-all ${
                        pct >= 80 ? 'bg-success-400' :
                        pct >= 60 ? 'bg-accent-400' :
                        'bg-warning-400'
                      }`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-medium text-neutral-500 mt-1">
                    {w.completed}/{w.total}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {adherence && adherence.weekly_breakdown.length === 1 && (
        <div>
          <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">This Week</h4>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-neutral-600">Week {adherence.weekly_breakdown[0].week}</span>
            <span className="text-xs font-bold text-neutral-700">
              {adherence.weekly_breakdown[0].completed}/{adherence.weekly_breakdown[0].total} days
            </span>
          </div>
          <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                (() => {
                  const pct = adherence.weekly_breakdown[0].total > 0
                    ? (adherence.weekly_breakdown[0].completed / adherence.weekly_breakdown[0].total) * 100 : 0
                  return pct >= 80 ? 'bg-success-500' : pct >= 60 ? 'bg-accent-500' : 'bg-warning-500'
                })()
              }`}
              style={{
                width: `${adherence.weekly_breakdown[0].total > 0
                  ? Math.max((adherence.weekly_breakdown[0].completed / adherence.weekly_breakdown[0].total) * 100, 4)
                  : 0}%`
              }}
            />
          </div>
        </div>
      )}

      {/* Daily log (last 7 days) — always show 7 days */}
      {adherence && adherence.daily_log.length > 0 && (() => {
        const logMap = new Map(adherence.daily_log.map(d => [d.date, d]))
        const days: { date: string; completed: boolean; exercises_done: number }[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const dateStr = d.toISOString().split('T')[0]
          const entry = logMap.get(dateStr)
          days.push(entry ?? { date: dateStr, completed: false, exercises_done: 0 })
        }
        return (
          <div>
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Last 7 Days</h4>
            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const d = new Date(day.date + 'T00:00:00')
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
                const isToday = day.date === new Date().toISOString().split('T')[0]
                return (
                  <div key={day.date} className="text-center">
                    <div className={`text-[10px] ${isToday ? 'text-primary-600 font-semibold' : 'text-neutral-400'}`}>
                      {isToday ? 'Now' : dayName}
                    </div>
                    <div
                      className={`w-full aspect-square rounded-md mt-1 flex items-center justify-center text-[10px] font-bold ${
                        day.completed
                          ? 'bg-success-100 text-success-700'
                          : isToday
                            ? 'bg-primary-50 text-primary-400 ring-1 ring-primary-200'
                            : 'bg-neutral-100 text-neutral-300'
                      }`}
                    >
                      {day.completed ? day.exercises_done : '--'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
