import { useEffect, useState } from 'react'
import { getAnalyticsV2 } from '../lib/api'
import type { AnalyticsV2Response } from '../lib/types'
import { AttentionList } from '../components/clinician/AttentionList'
import { AdherenceHeatmap } from '../components/clinician/AdherenceHeatmap'
import { ProgramEffectiveness } from '../components/clinician/ProgramEffectiveness'
import { EngagementSignals } from '../components/clinician/EngagementSignals'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsV2Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAnalyticsV2()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <LoadingSkeleton variant="card" count={4} />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 sm:p-6">
        <div className="card p-6 text-center">
          <p className="text-danger-600 text-sm">Failed to load analytics{error ? `: ${error}` : ''}</p>
        </div>
      </div>
    )
  }

  const handleExportCsv = () => {
    const rows: string[][] = [['Patient Name', 'Risk Level', 'Risk Score', 'Adherence %', 'Trend']]

    // Add attention list patients
    for (const p of data.attention) {
      rows.push([
        p.name,
        p.risk_level,
        String(p.risk_score),
        p.adherence_pct != null ? String(p.adherence_pct) : '',
        p.adherence_trend,
      ])
    }

    // Add heatmap patients not already in attention list
    const attentionIds = new Set(data.attention.map((p) => p.patient_id))
    for (const row of data.heatmap) {
      if (attentionIds.has(row.patient_id)) continue
      const completedDays = row.cells.filter((c) => c.completed).length
      const totalDays = row.cells.length
      const pct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0
      rows.push([row.name, '', '', String(pct), ''])
    }

    const csvContent = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadCsv(`analytics_${new Date().toISOString().slice(0, 10)}.csv`, csvContent)
  }

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-neutral-800">Analytics</h2>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:border-neutral-300 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Section 1: Needs Attention */}
      <div className="card p-5 mb-6">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Needs Attention
          {data.attention.length > 0 && (
            <span className="ml-1.5 text-danger-600 normal-case font-medium">
              ({data.attention.length})
            </span>
          )}
        </h3>
        <AttentionList patients={data.attention} />
      </div>

      {/* Section 2: 14-Day Activity */}
      <div className="card p-5 mb-6">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          14-Day Activity
        </h3>
        <AdherenceHeatmap
          rows={data.heatmap}
          dates={data.heatmap_dates}
          dailyRates={data.daily_rates}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Section 3: Program Effectiveness */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Program Effectiveness
          </h3>
          <ProgramEffectiveness programs={data.programs} outliers={data.outliers} />
        </div>

        {/* Section 4: Engagement Signals */}
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Engagement Signals
          </h3>
          <EngagementSignals
            silentPatients={data.silent_patients}
            unansweredPatients={data.unanswered_patients}
            milestones={data.milestones}
          />
        </div>
      </div>
    </div>
  )
}
