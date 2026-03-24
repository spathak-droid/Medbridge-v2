interface BarChartProps {
  data: { label: string; value: number; total: number }[]
  colorFn?: (value: number, total: number) => string
  height?: number
}

export function BarChart({ data, colorFn, height = 120 }: BarChartProps) {
  const defaultColor = (v: number, t: number) => {
    const pct = t > 0 ? (v / t) * 100 : 0
    if (pct >= 80) return 'bg-success-500'
    if (pct >= 60) return 'bg-accent-500'
    if (pct >= 40) return 'bg-warning-500'
    return 'bg-danger-500'
  }

  const getColor = colorFn ?? defaultColor

  return (
    <div className="flex items-end gap-1.5 sm:gap-2" style={{ height }}>
      {data.map((d) => {
        const pct = d.total > 0 ? (d.value / d.total) * 100 : 0
        return (
          <div key={d.label} className="flex flex-col items-center flex-1 h-full">
            <div className="flex-1 w-full flex items-end">
              <div
                className={`
                  w-full rounded-t-md
                  transition-all duration-500
                  ${getColor(d.value, d.total)}
                `}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400 mt-1.5 font-medium">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
