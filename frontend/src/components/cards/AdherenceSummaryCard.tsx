import type { AdherenceSummary } from '../../lib/types'
import { adherenceColor } from '../../lib/utils'

interface AdherenceSummaryCardProps {
  adherence: AdherenceSummary
}

export function AdherenceSummaryCard({ adherence }: AdherenceSummaryCardProps) {
  return (
    <div className="flex justify-start mb-4 ml-11 animate-fade-in-up">
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className="
          rounded-2xl bg-white
          border border-neutral-200/60
          border-l-[3px] border-l-primary-400
          shadow-card p-4
        ">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📊</span>
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Your Progress
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className={`text-xl font-bold ${adherenceColor(adherence.adherence_percentage)}`}>
                {adherence.adherence_percentage}%
              </div>
              <div className="text-[10px] text-neutral-400">Adherence</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-amber-500">
                🔥 {adherence.current_streak}
              </div>
              <div className="text-[10px] text-neutral-400">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-neutral-700">
                {adherence.days_completed}/{adherence.total_days_in_program}
              </div>
              <div className="text-[10px] text-neutral-400">Days Done</div>
            </div>
          </div>

          {/* Mini 7-day chart */}
          <div className="flex items-end gap-1 h-8">
            {adherence.daily_log.slice(-7).map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div
                  className={`
                    w-full rounded-sm
                    ${day.completed ? 'bg-primary-400' : 'bg-neutral-200'}
                  `}
                  style={{ height: day.completed ? '100%' : '30%' }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {adherence.daily_log.slice(-7).map((day) => (
              <div key={day.date} className="flex-1 text-center text-[8px] text-neutral-400">
                {new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
