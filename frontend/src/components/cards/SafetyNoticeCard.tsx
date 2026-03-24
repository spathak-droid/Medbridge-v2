interface SafetyNoticeCardProps {
  classification: 'CLINICAL_CONTENT' | 'CRISIS'
}

export function SafetyNoticeCard({ classification }: SafetyNoticeCardProps) {
  const isCrisis = classification === 'CRISIS'

  return (
    <div className="flex justify-start mb-4 ml-11 animate-fade-in-up">
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className={`
          rounded-2xl p-4
          ${isCrisis
            ? 'bg-red-50 border border-red-200'
            : 'bg-amber-50 border border-amber-200'
          }
        `}>
          <div className="flex items-center gap-2 mb-2">
            {isCrisis ? (
              <>
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                <span className="text-xs font-semibold text-red-700">Your care team has been notified</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="text-xs font-semibold text-amber-700">Redirected to care team</span>
              </>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${isCrisis ? 'text-red-600' : 'text-amber-700'}`}>
            {isCrisis
              ? 'We want to make sure you get the right support. Your care team has been notified and will reach out to you.'
              : 'For medical questions, your care team is best equipped to help. This coach focuses on exercise motivation and tracking.'
            }
          </p>
        </div>
      </div>
    </div>
  )
}
