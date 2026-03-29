import { useEffect, useState } from 'react'
import { getAnalyticsV2 } from '../lib/api'
import type { AnalyticsV2Response } from '../lib/types'
import { AttentionList } from '../components/clinician/AttentionList'
import { AdherenceHeatmap } from '../components/clinician/AdherenceHeatmap'
import { ProgramEffectiveness } from '../components/clinician/ProgramEffectiveness'
import { EngagementSignals } from '../components/clinician/EngagementSignals'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

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

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <h2 className="text-xl font-bold text-neutral-800 mb-6">Analytics</h2>

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
