import { useLocation, useNavigate } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import { adherenceColor, phaseColor, phaseLabel } from '../lib/utils'

interface PatientSwitcherProps {
  onClose: () => void
}

export function PatientSwitcher({ onClose }: PatientSwitcherProps) {
  const { patients, patientId, setPatientId } = usePatient()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const handleSelect = (id: number) => {
    setPatientId(id)
    // If on a clinician patient detail page, navigate to the selected patient
    if (pathname.startsWith('/dashboard/patient/')) {
      navigate(`/dashboard/patient/${id}`)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="
          relative w-full max-w-md mx-4
          bg-white rounded-2xl
          shadow-float
          border border-neutral-200/60
          animate-fade-in-up
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Switch Patient</h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">Select a patient to view their data</p>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-2">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelect(p.id)}
              className={`
                w-full flex items-center gap-3
                px-5 py-3
                text-left
                transition-colors
                ${p.id === patientId
                  ? 'bg-primary-50'
                  : 'hover:bg-neutral-50'
                }
              `}
            >
              {/* Avatar */}
              <div className="
                flex-shrink-0
                w-10 h-10 rounded-full
                bg-gradient-to-br from-primary-400 to-primary-600
                flex items-center justify-center
                text-white text-sm font-bold
              ">
                {p.name.split(' ').map(n => n[0]).join('')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-800 truncate">{p.name}</span>
                  <span className={`
                    inline-flex px-1.5 py-0.5 rounded-full
                    text-[10px] font-semibold
                    ${phaseColor(p.phase)}
                  `}>
                    {phaseLabel(p.phase)}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {p.adherence_pct !== null && (
                    <span className={`text-[11px] font-medium ${adherenceColor(p.adherence_pct)}`}>
                      {p.adherence_pct}% adherence
                    </span>
                  )}
                  {p.goal_summary && (
                    <span className="text-[11px] text-neutral-400 truncate">
                      {p.goal_summary.slice(0, 40)}...
                    </span>
                  )}
                </div>
              </div>

              {p.id === patientId && (
                <svg className="w-5 h-5 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
