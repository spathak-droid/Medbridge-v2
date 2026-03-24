interface ConsentScreenProps {
  patientId: number
  onConsent: () => void
  onDecline: () => void
  loading?: boolean
}

export function ConsentScreen({
  onConsent,
  onDecline,
  loading,
}: ConsentScreenProps) {
  return (
    <div
      data-testid="consent-screen"
      className="
        flex flex-col items-center justify-center
        flex-1 min-h-screen
        p-6
        bg-gradient-to-b from-primary-50/40 via-neutral-50 to-neutral-50
      "
    >
      <div className="
        w-full max-w-md
        animate-fade-in-up
      ">
        {/* Card */}
        <div className="card p-6 sm:p-8">
          {/* Shield icon */}
          <div className="flex justify-center mb-5">
            <div className="
              w-14 h-14 rounded-2xl
              bg-primary-50
              flex items-center justify-center
            ">
              <svg
                className="w-7 h-7 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="
            text-xl font-bold text-neutral-800
            text-center mb-2
          ">
            AI Exercise Coach Consent
          </h2>
          <p className="
            text-sm text-neutral-400
            text-center mb-6
          ">
            Please review how we use your data
          </p>

          {/* Info items */}
          <div className="space-y-4 mb-8">
            <ConsentItem
              icon={
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              }
              text={
                <>
                  MedBridge offers an <strong>AI exercise coach</strong> to
                  support your recovery with personalized guidance and check-ins.
                </>
              }
            />
            <ConsentItem
              icon={
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
              text={
                <>
                  This coach is <strong>not a medical provider</strong> and
                  does not replace your care team.
                </>
              }
            />
            <ConsentItem
              icon={
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
              }
              text={
                <>
                  The coach uses your <strong>exercise data</strong> and
                  conversation history to personalize recommendations.
                </>
              }
            />
            <ConsentItem
              icon={
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
              text={
                <>
                  You can <strong>revoke your consent</strong> at any time
                  from settings, and the coach will no longer contact you.
                </>
              }
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onConsent}
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Processing...' : 'I Agree'}
            </button>
            <button
              onClick={onDecline}
              disabled={loading}
              className="btn-ghost w-full py-3"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsentItem({
  icon,
  text,
}: {
  icon: React.ReactNode
  text: React.ReactNode
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="
        flex-shrink-0
        w-8 h-8 rounded-lg
        bg-primary-50
        text-primary-600
        flex items-center justify-center
      ">
        {icon}
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed pt-1">
        {text}
      </p>
    </div>
  )
}
