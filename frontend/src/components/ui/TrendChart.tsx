interface TrendChartProps {
  data: { label: string; value: number }[]
  maxValue: number
  color?: string
  gradientId?: string
}

export function TrendChart({ data, maxValue, color = '#6366f1', gradientId = 'trend-fill' }: TrendChartProps) {
  if (data.length === 0) return null

  const height = 120
  const paddingTop = 12
  const paddingBottom = 24
  const paddingX = 8
  const chartHeight = height - paddingTop - paddingBottom

  // Build points
  const points = data.map((d, i) => {
    const x = paddingX + (data.length === 1 ? 0.5 : i / (data.length - 1)) * (100 - paddingX * 2)
    const y = paddingTop + chartHeight - (d.value / maxValue) * chartHeight
    return { x, y, label: d.label, value: d.value }
  })

  // SVG path for smooth curve (catmull-rom to bezier)
  function toPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(i + 2, pts.length - 1)]
      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
  }

  const linePath = toPath(points)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`

  // Show a subset of x-axis labels to avoid overlap
  const maxLabels = 7
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels))

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${height}px` }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Filled area */}
      <path d={areaPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.2}
          fill="white"
          stroke={color}
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* X-axis labels */}
      {points.map((p, i) => {
        if (i % labelStep !== 0 && i !== points.length - 1) return null
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="3.5"
            fontFamily="system-ui, sans-serif"
          >
            {p.label}
          </text>
        )
      })}
    </svg>
  )
}
