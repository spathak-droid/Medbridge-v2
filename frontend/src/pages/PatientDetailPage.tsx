import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import {
  approveGoal,
  assignProgram,
  clearProgram,
  createReminder,
  createPatientNote,
  deletePatientNote,
  getAdherence,
  getAlerts,
  getAvailablePrograms,
  getGoals,
  getPatientNotes,
  getPatients,
  getSchedule,
  getVideoEngagement,
  rejectGoal,
} from '../lib/api'
import type {
  AdherenceSummary,
  AlertItem,
  ClinicalNote,
  Goal,
  PatientSummary,
  ScheduleEventItem,
  VideoEngagement,
} from '../lib/types'
import { phaseLabel, phaseColor } from '../lib/utils'
import { PatientInsights } from '../components/clinician/PatientInsights'
import { ProgramCompletionView } from '../components/clinician/ProgramCompletionView'
import { ScheduleTimeline } from '../components/clinician/ScheduleTimeline'
import { ClinicianMessaging } from '../components/clinician/ClinicianMessaging'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

type Tab = 'overview' | 'program' | 'messages' | 'notes'

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const patientId = Number(id)
  const { setPatientId } = usePatient()

  useEffect(() => {
    if (patientId) setPatientId(patientId)
  }, [patientId, setPatientId])

  const [patient, setPatient] = useState<PatientSummary | null>(null)
  const [adherence, setAdherence] = useState<AdherenceSummary | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [schedule, setSchedule] = useState<ScheduleEventItem[]>([])
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [reminderMsg, setReminderMsg] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [sendingReminder, setSendingReminder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectingGoalId, setRejectingGoalId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [goalActionLoading, setGoalActionLoading] = useState(false)
  const [showProgramSelect, setShowProgramSelect] = useState(false)
  const [programLoading, setProgramLoading] = useState(false)
  const [availablePrograms, setAvailablePrograms] = useState<{ program_type: string; program_name: string; exercise_count: number }[]>([])
  const [videoEngagement, setVideoEngagement] = useState<VideoEngagement | null>(null)

  const fetchData = () => {
    setError(null)
    setLoading(true)
    Promise.all([
      getPatients(),
      getAdherence(patientId),
      getGoals(patientId),
      getAlerts(),
      getSchedule(patientId),
      getPatientNotes(patientId).catch(() => []),
    ])
      .then(([patients, adh, g, allAlerts, sched, n]) => {
        setPatient(patients.find(p => p.id === patientId) ?? null)
        setAdherence(adh)
        setGoals(g)
        setAlerts(allAlerts.filter(a => a.patient_id === patientId))
        setSchedule(sched)
        setNotes(n)
      })
      .catch((err) => setError(err.message || 'Failed to load patient data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    getAvailablePrograms().then(setAvailablePrograms).catch(() => {})
    getVideoEngagement(patientId).then(setVideoEngagement).catch(() => {})
  }, [patientId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSkeleton variant="card" count={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <p className="text-neutral-500">Patient not found</p>
      </div>
    )
  }

  const programProgress = adherence?.per_exercise
    ? (() => {
        const entries = Object.values(adherence.per_exercise) as { completed: number; total: number }[]
        if (entries.length === 0) return 0
        const totalCompleted = entries.reduce((sum, e) => sum + e.completed, 0)
        const totalExpected = entries.reduce((sum, e) => sum + e.total, 0)
        return totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0
      })()
    : 0
  const upcomingSchedule = schedule.filter(s => s.status === 'PENDING')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'program', label: 'Program & Exercises' },
    { key: 'messages', label: 'Chat Logs' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/dashboard" className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </Link>
              <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">
                Patient Detail: {patient.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 ml-7">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${phaseColor(patient.phase)}`}>
                {phaseLabel(patient.phase)}
              </span>
              {patient.phase === 'ACTIVE' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                  Post-Surgery
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('messages')}
              className="
                flex items-center gap-2 px-4 py-2.5
                bg-primary-600 hover:bg-primary-700
                text-white rounded-lg text-sm font-semibold
                transition-all cursor-pointer shadow-sm
              "
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              Send Message
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200 mb-6">
        <nav className="flex gap-6 -mb-px">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`
                pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer
                ${activeTab === key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                }
              `}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
          {/* Main Content */}
          <div className="space-y-6">
            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Program Progress */}
              <div className="card p-5">
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Program Progress</h4>
                <div className="text-3xl font-bold text-neutral-800 mb-1">{programProgress}%</div>
                <div className="text-xs text-neutral-500 mb-3">Complete</div>
                <div className="w-full bg-neutral-100 rounded-full h-2">
                  <div
                    className="bg-primary-500 rounded-full h-2 transition-all duration-500"
                    style={{ width: `${programProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-neutral-400 mt-1.5">Program Progress</div>
              </div>

              {/* Adherence */}
              <div className="card p-5">
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Adherence</h4>
                <div className="text-3xl font-bold text-neutral-800 mb-1">
                  {adherence?.adherence_percentage ?? 0}%
                </div>
                <div className="text-xs text-neutral-500 mb-3">(Last 30 Days)</div>
                {/* Mini sparkline placeholder */}
                <div className="flex items-end gap-0.5 h-8">
                  {(adherence?.weekly_breakdown ?? []).slice(-6).map((w, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-primary-200 rounded-t"
                      style={{ height: `${Math.max((w.completed / Math.max(w.total, 1)) * 100, 8)}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* Pain Score / Streak */}
              <div className="card p-5">
                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Streak</h4>
                <div className="text-3xl font-bold text-neutral-800 mb-1">
                  {adherence?.current_streak ?? 0}
                </div>
                <div className="text-xs text-neutral-500 mb-3">Day streak</div>
                <div className="flex items-center gap-1 text-xs text-primary-600">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                  Longest: {adherence?.longest_streak ?? 0} days
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <PatientInsights patientId={patientId} />

            {/* Recent Activity / Alerts */}
            {alerts.length > 0 && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-700">Recent Activity</h3>
                  <span className="text-xs text-neutral-400">Recent</span>
                </div>
                <div className="space-y-4">
                  {alerts.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-start gap-3">
                      <div className="text-xs text-neutral-400 w-16 flex-shrink-0 pt-0.5">
                        {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="relative flex items-center">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          a.urgency === 'CRITICAL' ? 'bg-red-500' :
                          a.urgency === 'HIGH' ? 'bg-amber-500' : 'bg-neutral-300'
                        }`} />
                      </div>
                      <p className="text-sm text-neutral-600 flex-1">{a.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule & Reminders */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-700">Schedule & Reminders</h3>
                <button
                  onClick={() => {
                    const el = document.getElementById('reminder-form')
                    if (el) el.classList.toggle('hidden')
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer"
                >
                  + Set Reminder
                </button>
              </div>

              <div id="reminder-form" className="hidden bg-primary-50 rounded-lg p-3 mb-4 border border-primary-100">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={reminderMsg}
                    onChange={(e) => setReminderMsg(e.target.value)}
                    placeholder="Reminder message..."
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="flex-1 px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full sm:w-24 px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!reminderMsg.trim() || !reminderDate) return
                      setSendingReminder(true)
                      try {
                        const isoTime = new Date(`${reminderDate}T${reminderTime}:00`).toISOString()
                        const newEvent = await createReminder(patientId, reminderMsg.trim(), isoTime)
                        setSchedule((prev) => [...prev, newEvent])
                        setReminderMsg('')
                        setReminderDate('')
                        setReminderTime('09:00')
                        document.getElementById('reminder-form')?.classList.add('hidden')
                      } catch (err) {
                        console.error('Failed to create reminder:', err)
                      }
                      setSendingReminder(false)
                    }}
                    disabled={sendingReminder || !reminderMsg.trim() || !reminderDate}
                    className="w-full px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                  >
                    {sendingReminder ? 'Scheduling...' : 'Schedule Reminder'}
                  </button>
                </div>
              </div>

              <ScheduleTimeline events={schedule} />
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Current Program */}
            <div className="card p-5 border-l-4 border-l-primary-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-neutral-800">Current Program</h3>
                <span className="text-[11px] text-neutral-400">Summary</span>
              </div>
              {adherence ? (
                <>
                  <p className="text-sm text-neutral-600 mb-1">
                    Week {Math.min(adherence.weekly_breakdown.length, Math.ceil(adherence.days_completed / 7) || 1)}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-4">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    {adherence.days_completed} / {adherence.total_days_in_program} days completed
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setActiveTab('program')}
                      className="flex-1 py-2 rounded-lg border-2 border-primary-500 text-primary-600 text-sm font-semibold hover:bg-primary-50 transition-colors cursor-pointer"
                    >
                      View Program
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowProgramSelect(true)}
                      className="flex-1 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      disabled={programLoading}
                      onClick={async () => {
                        setProgramLoading(true)
                        try {
                          await clearProgram(patientId)
                          fetchData()
                        } catch {}
                        setProgramLoading(false)
                      }}
                      className="flex-1 py-1.5 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-neutral-400 mb-3">No program assigned</p>
                  <button
                    onClick={() => setShowProgramSelect(true)}
                    className="w-full py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Assign Program
                  </button>
                </div>
              )}

              {showProgramSelect && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Select Program</label>
                  <select
                    onChange={async (e) => {
                      const val = e.target.value
                      if (!val) return
                      setProgramLoading(true)
                      setShowProgramSelect(false)
                      try {
                        await assignProgram(patientId, val)
                        fetchData()
                      } catch {}
                      setProgramLoading(false)
                    }}
                    defaultValue=""
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">Choose...</option>
                    {availablePrograms.map((p) => (
                      <option key={p.program_type} value={p.program_type}>
                        {p.program_name} ({p.exercise_count} exercises)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowProgramSelect(false)}
                    className="w-full mt-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Patient Goals */}
            {goals.length > 0 && (
              <div className="card p-5">
                <h3 className="text-sm font-bold text-neutral-800 mb-3">Patient Goals</h3>
                <div className="space-y-3">
                  {goals.map(g => (
                    <div key={g.id} className="border border-neutral-100 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-1">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          g.clinician_approved ? 'bg-green-100 text-green-600'
                            : g.clinician_rejected ? 'bg-red-100 text-red-600'
                            : g.confirmed ? 'bg-amber-100 text-amber-600'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}>
                          {g.clinician_approved ? (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : g.clinician_rejected ? (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-neutral-600">{g.raw_text}</p>
                          {g.clinician_approved && (
                            <span className="text-[10px] font-medium text-green-600 mt-1 inline-block">Approved</span>
                          )}
                          {g.clinician_rejected && (
                            <div className="mt-1">
                              <span className="text-[10px] font-medium text-red-600">Rejected</span>
                              {g.rejection_reason && (
                                <p className="text-[11px] text-red-500 mt-0.5">Reason: {g.rejection_reason}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {g.confirmed && !g.clinician_approved && !g.clinician_rejected && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-[11px] font-medium text-amber-600">Pending your review</span>
                          </div>
                          {rejectingGoalId === g.id ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Reason for rejection..."
                                className="w-full px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex gap-2">
                                <button
                                  disabled={goalActionLoading || !rejectReason.trim()}
                                  onClick={async () => {
                                    setGoalActionLoading(true)
                                    try {
                                      await rejectGoal(g.id, rejectReason)
                                      setRejectingGoalId(null)
                                      setRejectReason('')
                                      getGoals(patientId).then(setGoals).catch(() => {})
                                    } catch {}
                                    setGoalActionLoading(false)
                                  }}
                                  className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                                >
                                  Confirm Reject
                                </button>
                                <button
                                  onClick={() => { setRejectingGoalId(null); setRejectReason('') }}
                                  className="py-1.5 px-3 text-neutral-500 text-xs font-medium hover:bg-neutral-50 rounded-lg transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                disabled={goalActionLoading}
                                onClick={async () => {
                                  setGoalActionLoading(true)
                                  try {
                                    await approveGoal(g.id)
                                    getGoals(patientId).then(setGoals).catch(() => {})
                                  } catch {}
                                  setGoalActionLoading(false)
                                }}
                                className="flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                disabled={goalActionLoading}
                                onClick={() => setRejectingGoalId(g.id)}
                                className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition disabled:opacity-50 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Appointments / Schedule */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-neutral-800 mb-3">Upcoming Appointments</h3>
              {upcomingSchedule.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSchedule.slice(0, 4).map(s => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-neutral-700 font-medium truncate">{s.message || s.event_type}</p>
                        <p className="text-[11px] text-neutral-400">
                          {new Date(s.scheduled_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">No upcoming appointments</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'program' && (
        <div className="space-y-4">
          <div className="card p-5">
            <ProgramCompletionView patientId={patientId} />
          </div>

          {videoEngagement && videoEngagement.exercises.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-neutral-700">Video Engagement</h3>
                <span className={`text-sm font-bold ${
                  videoEngagement.overall_video_adherence >= 80 ? 'text-success-600' :
                  videoEngagement.overall_video_adherence >= 50 ? 'text-accent-600' :
                  'text-warning-600'
                }`}>
                  {videoEngagement.overall_video_adherence.toFixed(0)}% overall
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="text-left py-2 pr-4 text-neutral-500 font-medium">Exercise</th>
                      <th className="text-center py-2 px-2 text-neutral-500 font-medium">Avg %</th>
                      <th className="text-center py-2 px-2 text-neutral-500 font-medium">Times</th>
                      <th className="text-center py-2 px-2 text-neutral-500 font-medium">Days</th>
                      <th className="text-right py-2 pl-2 text-neutral-500 font-medium">Last Watched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoEngagement.exercises.map((ex) => (
                      <tr key={ex.exercise_id} className="border-b border-neutral-50">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              ex.avg_watch_percentage >= 80 ? 'bg-success-500' :
                              ex.avg_watch_percentage >= 50 ? 'bg-accent-500' :
                              ex.avg_watch_percentage > 0 ? 'bg-warning-500' :
                              'bg-neutral-200'
                            }`} />
                            <span className="text-neutral-700">{ex.exercise_name}</span>
                          </div>
                        </td>
                        <td className="text-center py-2 px-2 font-medium text-neutral-600">
                          {ex.avg_watch_percentage.toFixed(0)}%
                        </td>
                        <td className="text-center py-2 px-2 text-neutral-600">{ex.total_watches}</td>
                        <td className="text-center py-2 px-2 text-neutral-600">{ex.days_watched}</td>
                        <td className="text-right py-2 pl-2 text-neutral-400">
                          {ex.last_watched || 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="card p-5">
          <ClinicianMessaging patientId={patientId} />
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4">Clinical Notes</h3>

          {/* Add note form */}
          <div className="mb-6">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a clinical note..."
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            <button
              onClick={async () => {
                if (!noteText.trim()) return
                setSavingNote(true)
                try {
                  const newNote = await createPatientNote(patientId, noteText.trim())
                  setNotes((prev) => [newNote, ...prev])
                  setNoteText('')
                } catch (err) {
                  console.error('Failed to save note:', err)
                }
                setSavingNote(false)
              }}
              disabled={savingNote || !noteText.trim()}
              className="mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer"
            >
              {savingNote ? 'Saving...' : 'Add Note'}
            </button>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <p className="text-sm text-neutral-400">No notes yet for this patient.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border border-neutral-100 rounded-lg p-4 bg-neutral-50">
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-neutral-400">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await deletePatientNote(patientId, note.id)
                          setNotes((prev) => prev.filter((n) => n.id !== note.id))
                        } catch (err) {
                          console.error('Failed to delete note:', err)
                        }
                      }}
                      className="text-xs text-red-400 hover:text-red-600 transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
