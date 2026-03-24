import { useEffect, useState } from 'react'
import { getPatientInsights, refreshPatientInsights } from '../../lib/api'
import type { PatientInsight } from '../../lib/types'

interface Props {
  patientId: number
}

export function PatientInsights({ patientId }: Props) {
  const [insight, setInsight] = useState<PatientInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPatientInsights(patientId)
      .then((data) => {
        if (data && data.summary) {
          setInsight(data)
          setLoading(false)
        } else {
          // No insights exist yet — auto-generate on first open
          setLoading(false)
          setRefreshing(true)
          refreshPatientInsights(patientId)
            .then(setInsight)
            .catch(() => {})
            .finally(() => setRefreshing(false))
        }
      })
      .catch(() => {
        // API error (e.g. 404) — try to generate fresh
        setLoading(false)
        setRefreshing(true)
        refreshPatientInsights(patientId)
          .then(setInsight)
          .catch(() => {})
          .finally(() => setRefreshing(false))
      })
  }, [patientId])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const updated = await refreshPatientInsights(patientId)
      setInsight(updated)
    } catch {}
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤖</span>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">AI Insights</h3>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-neutral-100 rounded w-3/4" />
          <div className="h-3 bg-neutral-100 rounded w-full" />
          <div className="h-3 bg-neutral-100 rounded w-5/6" />
          <div className="h-3 bg-neutral-100 rounded w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 border-l-4 border-l-primary-400">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">AI Insights</h3>
        </div>
        <div className="flex items-center gap-2">
          {insight && (
            <span className="text-[10px] text-neutral-400">
              {new Date(insight.generated_at).toLocaleDateString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[11px] text-primary-600 hover:text-primary-700 font-medium transition cursor-pointer disabled:opacity-50"
          >
            {refreshing ? 'Generating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {insight ? (
        <div className="prose-sm text-neutral-700">
          {insight.summary.split('\n').map((line, i) => {
            if (line.startsWith('## ')) {
              return (
                <h4 key={i} className="text-xs font-bold text-neutral-800 uppercase tracking-wider mt-3 mb-1 first:mt-0">
                  {line.replace('## ', '')}
                </h4>
              )
            }
            if (line.startsWith('- ')) {
              return (
                <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
                  <span className="text-primary-500 mt-0.5">-</span>
                  <span className="text-xs leading-relaxed">{line.replace('- ', '')}</span>
                </div>
              )
            }
            if (line.trim() === '') return <div key={i} className="h-1" />
            // Highlight risk level
            const riskMatch = line.match(/\b(LOW|MODERATE|HIGH)\b/)
            if (riskMatch) {
              const riskColor = riskMatch[1] === 'HIGH' ? 'text-red-600 bg-red-50' :
                riskMatch[1] === 'MODERATE' ? 'text-amber-600 bg-amber-50' :
                'text-green-600 bg-green-50'
              return (
                <p key={i} className="text-xs leading-relaxed my-0.5">
                  {line.split(riskMatch[1]).map((part, j) => (
                    j === 0 ? (
                      <span key={j}>{part}<span className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${riskColor}`}>{riskMatch[1]}</span></span>
                    ) : (
                      <span key={j}>{part}</span>
                    )
                  ))}
                </p>
              )
            }
            return <p key={i} className="text-xs leading-relaxed my-0.5">{line}</p>
          })}
        </div>
      ) : refreshing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-primary-600 font-medium">Generating AI insights...</p>
          </div>
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-neutral-100 rounded w-3/4" />
            <div className="h-3 bg-neutral-100 rounded w-full" />
            <div className="h-3 bg-neutral-100 rounded w-5/6" />
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-400">No insights available. Click Refresh to generate.</p>
      )}
    </div>
  )
}
