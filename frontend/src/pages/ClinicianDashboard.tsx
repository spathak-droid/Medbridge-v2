import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAlerts, getAnalyticsV2, getPatients, getRiskScores, acknowledgeAlert, createPatient, getAvailablePrograms } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { AlertItem, AnalyticsV2Response, PatientSummary, RiskAssessment } from '../lib/types'
import { PatientRoster } from '../components/clinician/PatientRoster'
import { AlertPanel } from '../components/clinician/AlertPanel'
import { AttentionList } from '../components/clinician/AttentionList'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'
import { formatRelativeTime } from '../lib/utils'

export function ClinicianDashboard() {
  const { user } = useAuth()
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [riskScores, setRiskScores] = useState<Record<number, RiskAssessment>>({})
  const [v2Data, setV2Data] = useState<AnalyticsV2Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientEmail, setNewPatientEmail] = useState('')
  const [newPatientProgram, setNewPatientProgram] = useState('')
  const [addingPatient, setAddingPatient] = useState(false)
  const [addPatientError, setAddPatientError] = useState('')
  const [availablePrograms, setAvailablePrograms] = useState<{ program_type: string; program_name: string; exercise_count: number }[]>([])

  const fetchDashboard = () => {
    setError(null)
    setLoading(true)
    Promise.all([
      getPatients(true, user?.uid),
      getAlerts(),
      getRiskScores().catch(() => []),
      getAnalyticsV2().catch(() => null),
    ])
      .then(([p, a, risks, analytics]) => {
        setPatients(p)
        setAlerts(a)
        const riskMap: Record<number, RiskAssessment> = {}
        for (const r of risks) {
          riskMap[r.patient_id] = r
        }
        setRiskScores(riskMap)
        setV2Data(analytics)
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDashboard()
    getAvailablePrograms().then(setAvailablePrograms).catch(() => {})
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
  const avgAdherence = patients.length > 0
    ? Math.round(patients.reduce((sum, p) => sum + (p.adherence_pct ?? 0), 0) / patients.filter(p => p.adherence_pct !== null).length || 0)
    : 0

  // Positive milestones (streak + adherence)
  const wins = (v2Data?.milestones ?? []).filter(
    (m) => m.event_type === 'streak_milestone' || m.event_type === 'adherence_milestone' || m.event_type === 'goal_confirmed'
  )

  const MILESTONE_ICONS: Record<string, { bg: string; icon: string }> = {
    streak_milestone: { bg: 'bg-green-400', icon: 'S' },
    adherence_milestone: { bg: 'bg-blue-400', icon: 'A' },
    goal_confirmed: { bg: 'bg-emerald-400', icon: 'G' },
  }

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-neutral-800">My Patients</h2>
        <button
          onClick={() => setShowAddPatient(true)}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Patient
        </button>
      </div>

      {showAddPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-neutral-800 mb-4">Add New Patient</h3>
            {addPatientError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                {addPatientError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Patient name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newPatientEmail}
                  onChange={(e) => setNewPatientEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="patient@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Exercise Program</label>
                <select
                  value={newPatientProgram}
                  onChange={(e) => setNewPatientProgram(e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">Select a program...</option>
                  {availablePrograms.map((p) => (
                    <option key={p.program_type} value={p.program_type}>
                      {p.program_name} ({p.exercise_count} exercises)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddPatient(false)
                  setAddPatientError('')
                  setNewPatientName('')
                  setNewPatientEmail('')
                  setNewPatientProgram('')
                }}
                className="flex-1 py-2.5 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-medium hover:bg-neutral-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={addingPatient || !newPatientName || !newPatientEmail || !newPatientProgram}
                onClick={async () => {
                  setAddingPatient(true)
                  setAddPatientError('')
                  try {
                    await createPatient(newPatientName, newPatientEmail, newPatientProgram)
                    setShowAddPatient(false)
                    setNewPatientName('')
                    setNewPatientEmail('')
                    setNewPatientProgram('')
                    fetchDashboard()
                  } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Failed to create patient'
                    setAddPatientError(msg)
                  } finally {
                    setAddingPatient(false)
                  }
                }}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 cursor-pointer"
              >
                {addingPatient ? 'Creating...' : 'Create Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-800">{patients.length}</div>
            <div className="text-xs text-neutral-500">Total Patients</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${newAlerts.length > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-800">{newAlerts.length}</div>
            <div className="text-xs text-neutral-500">Active Alerts</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-800">{avgAdherence}%</div>
            <div className="text-xs text-neutral-500">Avg Adherence</div>
          </div>
        </div>
      </div>

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

        {/* Briefing Panel */}
        <div className="space-y-6">
          {/* Needs Attention */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700">Needs Attention</h3>
              <Link to="/analytics" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                View all
              </Link>
            </div>
            <AttentionList patients={(v2Data?.attention ?? []).slice(0, 3)} />
          </div>

          {/* Wins & Milestones */}
          <div className="card p-4 border-l-4 border-l-green-400">
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Wins & Milestones</h3>
            {wins.length === 0 ? (
              <p className="text-xs text-neutral-400">No recent wins to celebrate</p>
            ) : (
              <div className="space-y-2">
                {wins.slice(0, 5).map((m, i) => {
                  const cfg = MILESTONE_ICONS[m.event_type] ?? { bg: 'bg-green-400', icon: 'W' }
                  return (
                    <div key={`${m.event_type}-${m.patient_id}-${i}`} className="flex items-start gap-2">
                      <div className={`w-5 h-5 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <span className="text-white text-[9px] font-bold">{cfg.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-neutral-700 leading-snug">
                          <span className="font-medium">{m.patient_name}</span>
                          {' — '}
                          {m.description}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5">
                          {formatRelativeTime(m.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Alerts */}
          <div>
            <div className="flex items-center justify-between mb-3">
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
    </div>
  )
}
