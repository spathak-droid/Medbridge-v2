import type { HeatmapRow, DailyRate } from '../../lib/types'

interface AdherenceHeatmapProps {
  rows: HeatmapRow[]
  dates: string[]
  dailyRates: DailyRate[]
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'narrow' })
}

export function AdherenceHeatmap({ rows, dates, dailyRates }: AdherenceHeatmapProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-400 text-center py-4">
        No patients with assigned programs yet
      </p>
    )
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <div className="inline-block min-w-full">
        {/* Date headers */}
        <div className="flex items-end mb-1">
          <div className="w-24 flex-shrink-0" />
          <div className="flex gap-[3px]">
            {dates.map((d, i) => (
              <div key={d} className="w-6 text-center">
                {i % 2 === 0 && (
                  <span className="text-[9px] text-neutral-400 leading-none">
                    {formatDayLabel(d)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Patient rows */}
        {rows.map((row) => (
          <div key={row.patient_id} className="flex items-center mb-[3px]">
            <div className="w-24 flex-shrink-0 pr-2">
              <span className="text-xs text-neutral-600 truncate block">
                {row.name.split(' ')[0]}
              </span>
            </div>
            <div className="flex gap-[3px]">
              {row.cells.map((cell) => (
                <div
                  key={cell.date}
                  className={`w-6 h-6 rounded-sm ${
                    cell.completed
                      ? 'bg-emerald-400'
                      : 'bg-neutral-200'
                  }`}
                  title={`${row.name} — ${formatDateLabel(cell.date)}: ${cell.completed ? 'Completed' : 'Missed'}`}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Aggregate daily rate bars */}
        <div className="flex items-end mt-3 pt-3 border-t border-neutral-100">
          <div className="w-24 flex-shrink-0 pr-2">
            <span className="text-[10px] text-neutral-400 font-medium uppercase">Daily rate</span>
          </div>
          <div className="flex gap-[3px]">
            {dailyRates.map((dr) => (
              <div key={dr.date} className="w-6 flex flex-col items-center">
                <div className="w-4 bg-neutral-100 rounded-sm overflow-hidden" style={{ height: '28px' }}>
                  <div
                    className="w-full bg-primary-500 rounded-sm transition-all"
                    style={{
                      height: `${dr.rate}%`,
                      marginTop: `${100 - dr.rate}%`,
                    }}
                  />
                </div>
                <span className="text-[8px] text-neutral-400 mt-0.5">
                  {Math.round(dr.rate)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Date labels row */}
        <div className="flex items-center mt-1">
          <div className="w-24 flex-shrink-0" />
          <div className="flex gap-[3px]">
            {dates.map((d, i) => (
              <div key={d} className="w-6 text-center">
                {(i === 0 || i === 6 || i === 13) && (
                  <span className="text-[8px] text-neutral-400">
                    {formatDateLabel(d)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
