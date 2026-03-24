interface GoalConfirmationCardProps {
  goalText: string
  onConfirm: () => void
  onEdit: () => void
  confirmed: boolean
}

export function GoalConfirmationCard({
  goalText,
  onConfirm,
  onEdit,
  confirmed,
}: GoalConfirmationCardProps) {
  return (
    <div
      data-testid="goal-confirmation-card"
      className="flex justify-start mb-4 ml-11 animate-fade-in-up"
    >
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className="
          relative overflow-hidden
          rounded-2xl
          bg-white
          border border-primary-200
          shadow-card
          p-4
        ">
          {/* Gradient top accent */}
          <div className="
            absolute top-0 left-0 right-0 h-1
            bg-gradient-to-r from-primary-400 via-primary-500 to-accent-400
          " />

          {/* Header */}
          <div className="flex items-center gap-2 mb-3 mt-1">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Proposed Goal
            </span>
          </div>

          {/* Goal text */}
          <p className="text-sm text-neutral-700 leading-relaxed mb-4">
            {goalText}
          </p>

          {/* Actions */}
          {confirmed ? (
            <div className="
              flex items-center gap-2
              text-sm font-semibold text-success-600
            ">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Goal confirmed!
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={onConfirm}
                className="btn-primary px-5 py-2 text-xs"
              >
                Confirm Goal
              </button>
              <button
                onClick={onEdit}
                className="btn-ghost px-5 py-2 text-xs"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
