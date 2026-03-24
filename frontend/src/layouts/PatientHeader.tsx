import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import { useAuth } from '../contexts/AuthContext'
import { phaseColor, phaseLabel } from '../lib/utils'
import { PatientSwitcher } from './PatientSwitcher'

export function PatientHeader() {
  const { patient } = usePatient()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const isClinician = user?.role === 'clinician'
  const isPatientDetail = pathname.startsWith('/dashboard/patient/')

  // Clinician header on patient detail pages
  if (isClinician && isPatientDetail) {
    return (
      <>
        <header className="
          sticky top-0 z-30
          flex items-center justify-between
          px-4 sm:px-6 py-3
          bg-white/80 backdrop-blur-lg
          border-b border-neutral-200/60
          shadow-sm
        ">
          <span className="text-sm font-medium text-neutral-500">Clinician</span>
          <button
            onClick={() => setShowSwitcher(true)}
            className="
              flex items-center gap-1.5
              px-3 py-1.5 rounded-lg
              text-xs font-medium text-neutral-500
              hover:bg-neutral-100
              transition-colors cursor-pointer
            "
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Switch
          </button>
        </header>
        {showSwitcher && <PatientSwitcher onClose={() => setShowSwitcher(false)} />}
      </>
    )
  }

  if (!patient) return null

  return (
    <>
      <header className="
        sticky top-0 z-30
        flex items-center justify-between
        px-4 sm:px-6 py-3
        bg-white/80 backdrop-blur-lg
        border-b border-neutral-200/60
        shadow-sm
      ">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className="
            flex-shrink-0
            w-9 h-9 rounded-full
            bg-gradient-to-br from-primary-400 to-primary-600
            flex items-center justify-center
            text-white text-sm font-bold
          ">
            {patient.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-neutral-800 truncate">
                {patient.name}
              </h1>
              <span className={`
                inline-flex px-2 py-0.5 rounded-full
                text-[10px] font-semibold
                ${phaseColor(patient.phase)}
              `}>
                {phaseLabel(patient.phase)}
              </span>
            </div>
            {patient.goal_summary && (
              <p className="text-[11px] text-neutral-400 truncate max-w-[180px] sm:max-w-[300px]">
                {patient.goal_summary}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowSwitcher(true)}
          className="
            flex items-center gap-1.5
            px-3 py-1.5 rounded-lg
            text-xs font-medium text-neutral-500
            hover:bg-neutral-100
            transition-colors cursor-pointer
          "
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          <span className="hidden sm:inline">Switch</span>
        </button>
      </header>

      {showSwitcher && <PatientSwitcher onClose={() => setShowSwitcher(false)} />}
    </>
  )
}
