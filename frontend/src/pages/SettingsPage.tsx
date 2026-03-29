import { useState } from 'react'
import { usePatient } from '../hooks/usePatient'
import { useAuth } from '../contexts/AuthContext'
import { updateConsent } from '../lib/api'
import { phaseColor, phaseLabel } from '../lib/utils'

export function SettingsPage() {
  const { user } = useAuth()
  const isClinician = user?.role === 'clinician'

  if (isClinician) return <ClinicianSettings />
  return <PatientSettings />
}

function ClinicianSettings() {
  const { user } = useAuth()

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full animate-fade-in">
      <h2 className="text-xl font-bold text-neutral-800 mb-6">Settings</h2>

      <div className="card p-5 mb-4">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Account</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-neutral-500">Name</span>
            <span className="text-sm font-medium text-neutral-800">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-500">Email</span>
            <span className="text-sm font-mono text-neutral-600">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-neutral-500">Role</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700">
              Clinician
            </span>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-700">Email notifications</p>
              <p className="text-[11px] text-neutral-400">Receive alerts for critical patient events</p>
            </div>
            <div className="w-10 h-6 bg-primary-500 rounded-full relative cursor-pointer">
              <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-700">Daily digest</p>
              <p className="text-[11px] text-neutral-400">Summary of patient activity each morning</p>
            </div>
            <div className="w-10 h-6 bg-neutral-200 rounded-full relative cursor-pointer">
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">About</h3>
        <p className="text-sm text-neutral-500 leading-relaxed">
          CareArc is a clinical rehabilitation platform that helps you manage patient programs,
          track adherence, and communicate with patients through AI-assisted coaching.
        </p>
        <p className="text-[11px] text-neutral-400 mt-3">Version 0.2.0</p>
      </div>
    </div>
  )
}

function PatientSettings() {
  const { patient, patientId, refresh } = usePatient()
  const [revoking, setRevoking] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleRevokeConsent = async () => {
    setRevoking(true)
    try {
      await updateConsent(patientId, false)
      refresh()
    } catch (err) {
      console.error('Failed to revoke consent:', err)
    } finally {
      setRevoking(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full animate-fade-in">
      <h2 className="text-xl font-bold text-neutral-800 mb-6">Settings</h2>

      <div className="card p-5 mb-4">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Patient Info</h3>
        {patient && (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">Name</span>
              <span className="text-sm font-medium text-neutral-800">{patient.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">ID</span>
              <span className="text-sm font-mono text-neutral-600">{patient.external_id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-500">Phase</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${phaseColor(patient.phase)}`}>
                {phaseLabel(patient.phase)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-neutral-500">Consent</span>
              <span className={`text-sm font-medium ${patient.consent_given ? 'text-success-600' : 'text-danger-600'}`}>
                {patient.consent_given ? 'Granted' : 'Not given'}
              </span>
            </div>
          </div>
        )}
      </div>

      {patient?.consent_given && (
        <div className="card p-5 mb-4">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Privacy</h3>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-sm text-danger-600 hover:text-danger-700 font-medium"
            >
              Revoke consent for AI coaching
            </button>
          ) : (
            <div>
              <p className="text-sm text-neutral-600 mb-3">
                Are you sure? This will disable the AI coach. You can re-enable it later from the consent screen.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleRevokeConsent}
                  disabled={revoking}
                  className="px-4 py-2 text-sm font-medium text-white bg-danger-600 rounded-lg hover:bg-danger-700 disabled:opacity-50"
                >
                  {revoking ? 'Revoking...' : 'Yes, revoke'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg hover:bg-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">About</h3>
        <p className="text-sm text-neutral-500 leading-relaxed">
          CareArc AI Coach is an exercise coaching assistant designed to support your rehabilitation journey.
          It helps you set goals, track progress, and stay motivated with personalized check-ins.
        </p>
        <p className="text-[11px] text-neutral-400 mt-3">Version 0.2.0</p>
      </div>
    </div>
  )
}
