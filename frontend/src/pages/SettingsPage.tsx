import { useState, useEffect } from 'react'
import { usePatient } from '../hooks/usePatient'
import { useAuth } from '../contexts/AuthContext'
import { updateConsent } from '../lib/api'
import { phaseColor, phaseLabel } from '../lib/utils'
import { useStaggerIn } from '../hooks/useGsap'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

const PREFS_KEY = 'carearc_notification_prefs'

interface NotificationPrefs {
  exerciseReminders: boolean
  messageNotifications: boolean
  weeklyDigest: boolean
}

function loadPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return { exerciseReminders: true, messageNotifications: true, weeklyDigest: false }
}

function savePrefs(prefs: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function SettingsPage() {
  const { user } = useAuth()
  const isClinician = user?.role === 'clinician'

  if (isClinician) return <ClinicianSettings />
  return <PatientSettings />
}

/* ────────────────────────────────────────────────────────────── */
/*  Toggle Switch Component                                      */
/* ────────────────────────────────────────────────────────────── */

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-primary-500' : 'bg-neutral-300'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Patient Settings (Redesigned)                                */
/* ────────────────────────────────────────────────────────────── */

function PatientSettings() {
  const { user, signOut } = useAuth()
  const { patient, patientId, loading } = usePatient()
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs)
  const [showDeleteMsg, setShowDeleteMsg] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const containerRef = useStaggerIn('[data-section]', [patient])

  const updatePref = (key: keyof NotificationPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    savePrefs(next)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
      {/* Breadcrumb Header */}
      <div data-section className="mb-8">
        <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">Clinical Portal</p>
        <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">Settings</h1>
      </div>

      {/* ── Profile Section ── */}
      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">Profile</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Display Name</span>
            <span className="text-sm font-medium text-neutral-800">{patient?.name ?? user?.name ?? '—'}</span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Email</span>
            <span className="text-sm font-mono text-neutral-600">{user?.email ?? '—'}</span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Patient ID</span>
            <span className="text-sm font-mono text-neutral-600">{patient?.external_id ?? '—'}</span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Role</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700 capitalize">
              {user?.role ?? 'Patient'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Preferences Section ── */}
      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">Notification Preferences</h2>
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Exercise Reminders</p>
              <p className="text-xs text-neutral-400 mt-0.5">Daily reminders for scheduled exercises</p>
            </div>
            <ToggleSwitch
              checked={prefs.exerciseReminders}
              onChange={(v) => updatePref('exerciseReminders', v)}
            />
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Message Notifications</p>
              <p className="text-xs text-neutral-400 mt-0.5">Alerts when your care team sends a message</p>
            </div>
            <ToggleSwitch
              checked={prefs.messageNotifications}
              onChange={(v) => updatePref('messageNotifications', v)}
            />
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Weekly Digest</p>
              <p className="text-xs text-neutral-400 mt-0.5">Weekly summary of your progress and activity</p>
            </div>
            <ToggleSwitch
              checked={prefs.weeklyDigest}
              onChange={(v) => updatePref('weeklyDigest', v)}
            />
          </div>
        </div>
      </div>

      {/* ── App Info Section ── */}
      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">App Info</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">App Version</span>
            <span className="text-sm font-mono text-neutral-600">1.0.0</span>
          </div>
          <div className="border-t border-neutral-100" />
          <a href="#about" className="flex items-center justify-between group py-1">
            <span className="text-sm text-neutral-700 group-hover:text-primary-600 transition-colors">About CareArc</span>
            <svg className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
          <div className="border-t border-neutral-100" />
          <a href="#privacy" className="flex items-center justify-between group py-1">
            <span className="text-sm text-neutral-700 group-hover:text-primary-600 transition-colors">Privacy Policy</span>
            <svg className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
          <div className="border-t border-neutral-100" />
          <a href="#terms" className="flex items-center justify-between group py-1">
            <span className="text-sm text-neutral-700 group-hover:text-primary-600 transition-colors">Terms of Service</span>
            <svg className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div data-section className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Sign Out</p>
              <p className="text-xs text-neutral-400 mt-0.5">Sign out of your CareArc account</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
          <div className="border-t border-red-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Delete Account</p>
              <p className="text-xs text-neutral-400 mt-0.5">Permanently remove your account and data</p>
            </div>
            <button
              onClick={() => setShowDeleteMsg(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Account
            </button>
          </div>
          {showDeleteMsg && (
            <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Contact Support</p>
                  <p className="text-xs text-amber-700 mt-1">
                    To delete your account, please contact your care team or email{' '}
                    <span className="font-medium">support@carearc.com</span>. They will assist you with the account deletion process.
                  </p>
                  <button
                    onClick={() => setShowDeleteMsg(false)}
                    className="mt-3 text-xs font-medium text-amber-700 hover:text-amber-900 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-8" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Clinician Settings (Preserved)                               */
/* ────────────────────────────────────────────────────────────── */

function ClinicianSettings() {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useStaggerIn('[data-section]', [])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div ref={containerRef} className="p-4 sm:p-6 max-w-2xl mx-auto w-full">
      <div data-section className="mb-8">
        <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1">Clinical Portal</p>
        <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">Settings</h1>
      </div>

      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">Account</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Name</span>
            <span className="text-sm font-medium text-neutral-800">{user?.name}</span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Email</span>
            <span className="text-sm font-mono text-neutral-600">{user?.email ?? '—'}</span>
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">Role</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary-50 text-primary-700">
              Clinician
            </span>
          </div>
        </div>
      </div>

      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">Preferences</h2>
        </div>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Email notifications</p>
              <p className="text-xs text-neutral-400 mt-0.5">Receive alerts for critical patient events</p>
            </div>
            <ToggleSwitch checked={true} onChange={() => {}} />
          </div>
          <div className="border-t border-neutral-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Daily digest</p>
              <p className="text-xs text-neutral-400 mt-0.5">Summary of patient activity each morning</p>
            </div>
            <ToggleSwitch checked={false} onChange={() => {}} />
          </div>
        </div>
      </div>

      <div data-section className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-800">About</h2>
        </div>
        <p className="text-sm text-neutral-500 leading-relaxed">
          CareArc is a clinical rehabilitation platform that helps you manage patient programs,
          track adherence, and communicate with patients through AI-assisted coaching.
        </p>
        <p className="text-xs text-neutral-400 mt-3 font-mono">Version 1.0.0</p>
      </div>

      <div data-section className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-700">Sign Out</p>
            <p className="text-xs text-neutral-400 mt-0.5">Sign out of your CareArc account</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>

      <div className="h-8" />
    </div>
  )
}
