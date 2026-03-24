import { useEffect, useState } from 'react'
import { getConsentStatus, updateConsent } from '../lib/api'
import { ConsentScreen } from './ConsentScreen'

interface ConsentGateProps {
  patientId: number
  children: React.ReactNode
  onDecline?: () => void
}

export function ConsentGate({ patientId, children, onDecline }: ConsentGateProps) {
  const [consented, setConsented] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getConsentStatus(patientId)
      .then((status) => setConsented(status.consent_given))
      .finally(() => setLoading(false))
  }, [patientId])

  const handleConsent = async () => {
    setSubmitting(true)
    try {
      await updateConsent(patientId, true)
      setConsented(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDecline = () => {
    onDecline?.()
  }

  if (loading) {
    return (
      <div className="
        flex items-center justify-center
        flex-1 min-h-screen
        bg-neutral-50
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
          <span className="text-sm text-neutral-400">Loading...</span>
        </div>
      </div>
    )
  }

  if (!consented) {
    return (
      <ConsentScreen
        patientId={patientId}
        onConsent={handleConsent}
        onDecline={handleDecline}
        loading={submitting}
      />
    )
  }

  return <>{children}</>
}
