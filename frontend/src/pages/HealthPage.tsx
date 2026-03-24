export function HealthPage() {
  return (
    <div className="
      flex flex-col items-center justify-center
      flex-1 min-h-[60vh]
      p-6
      bg-neutral-50
    ">
      <div className="card p-8 text-center max-w-sm w-full animate-fade-in-up">
        {/* Logo */}
        <div className="flex justify-center mb-5">
          <div className="
            w-12 h-12 rounded-xl
            bg-gradient-to-br from-primary-400 to-primary-600
            flex items-center justify-center
            shadow-sm
          ">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-xl font-bold text-neutral-800 mb-2">
          MedBridge
        </h1>

        <div className="
          inline-flex items-center gap-2
          bg-success-50
          text-success-600
          rounded-full
          px-4 py-1.5
          text-sm font-semibold
          mb-3
        ">
          <span className="w-2 h-2 rounded-full bg-success-500" />
          Status: OK
        </div>

        <p className="text-xs text-neutral-400">
          Frontend v0.0.0
        </p>
      </div>
    </div>
  )
}
