import { useEffect, useState } from 'react'
import { AlertCard } from '../components/AlertCard'
import { acknowledgeAlert, getAlerts } from '../lib/api'
import type { AlertItem } from '../lib/types'

export function AlertsDashboard() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAlerts()
      .then(setAlerts)
      .finally(() => setLoading(false))
  }, [])

  const handleAcknowledge = async (alertId: number) => {
    const updated = await acknowledgeAlert(alertId)
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? updated : a)),
    )
  }

  const totalAlerts = alerts.length
  const newAlerts = alerts.filter((a) => a.status === 'NEW').length
  const criticalAlerts = alerts.filter((a) => a.urgency === 'CRITICAL').length

  if (loading) {
    return (
      <div className="
        flex items-center justify-center
        flex-1 min-h-[60vh]
      ">
        <div className="flex flex-col items-center gap-3 animate-pulse-soft">
          <div className="
            w-10 h-10 rounded-xl
            bg-primary-100
            flex items-center justify-center
          ">
            <svg
              className="w-5 h-5 text-primary-500 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <span className="text-sm text-neutral-400">Loading alerts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 bg-neutral-50">
      {/* Header with stats */}
      <div className="
        bg-white
        border-b border-neutral-200/60
        px-4 sm:px-6 py-5
      ">
        <div className="max-w-3xl mx-auto">
          <h1 className="
            text-xl font-bold text-neutral-800
            mb-4
          ">
            Clinician Alerts
          </h1>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Total"
              value={totalAlerts}
              color="bg-neutral-100 text-neutral-700"
            />
            <StatCard
              label="New"
              value={newAlerts}
              color="bg-primary-50 text-primary-700"
            />
            <StatCard
              label="Critical"
              value={criticalAlerts}
              color="bg-danger-50 text-danger-600"
            />
          </div>
        </div>
      </div>

      {/* Alert list */}
      <div className="
        flex-1 overflow-y-auto
        px-4 sm:px-6 py-5
      ">
        <div className="max-w-3xl mx-auto space-y-3">
          {alerts.length === 0 ? (
            <EmptyState />
          ) : (
            alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`
      rounded-xl px-4 py-3
      ${color}
      text-center
    `}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-70 uppercase tracking-wide">
        {label}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="
      flex flex-col items-center justify-center
      py-20
      text-center
      animate-fade-in
    ">
      <div className="
        w-16 h-16 rounded-2xl
        bg-success-50
        flex items-center justify-center
        mb-5
      ">
        <svg
          className="w-8 h-8 text-success-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-neutral-700 mb-2">
        All clear
      </h2>
      <p className="text-sm text-neutral-400 max-w-sm">
        There are no active alerts at this time. Alerts will appear here
        when the coaching system flags patient interactions requiring
        clinician attention.
      </p>
    </div>
  )
}
