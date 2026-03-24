import { useEffect, useState } from 'react'
import { getAlerts, getPatients, getRiskScores, acknowledgeAlert } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { AlertItem, PatientSummary, RiskAssessment } from '../lib/types'
import { PatientRoster } from '../components/clinician/PatientRoster'
import { AlertPanel } from '../components/clinician/AlertPanel'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

export function ClinicianDashboard() {
  const { user } = useAuth()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [riskScores, setRiskScores] = useState<Record<number, RiskAssessment>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = () => {
    setError(null)
    setLoading(true)
    Promise.all([getPatients(true, user?.uid), getAlerts(), getRiskScores().catch(() => [])])
      .then(([p, a, risks]) => {
        setPatients(p)
        setAlerts(a)
        const riskMap: Record<number, RiskAssessment> = {}
        for (const r of risks) {
          riskMap[r.patient_id] = r
        }
        setRiskScores(riskMap)
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDashboard()
  }, [user?.uid])

  const handleAcknowledge = async (id: number) => {
    try {
      await acknowledgeAlert(id)
      setAlerts((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: 'ACKNOWLEDGED' as const } : a)
      )
    } catch (err) {
      console.error('Failed to acknowledge alert:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const newAlerts = alerts.filter((a) => a.status === 'NEW')

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <h2 className="text-xl font-bold text-neutral-800 mb-6">My Patients</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Patient roster */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-600">
              Patient Roster ({patients.length})
            </h3>
          </div>
          <PatientRoster patients={patients} riskScores={riskScores} />
        </div>

        {/* Alerts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-neutral-600">
              Alerts
              {newAlerts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {newAlerts.length}
                </span>
              )}
            </h3>
          </div>
          <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} />
        </div>
      </div>
    </div>
  )
}
