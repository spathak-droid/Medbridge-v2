interface WelcomeStateProps {
  onStartOnboarding: () => void
  loading?: boolean
}

export function WelcomeState({ onStartOnboarding, loading }: WelcomeStateProps) {
  return (
    <div className="
      flex flex-col items-center justify-center
      flex-1 min-h-[70vh]
      p-6 sm:p-8
      text-center
      animate-fade-in
    ">
      {/* Gradient glow background */}
      <div className="
        absolute inset-0 -z-10
        bg-gradient-to-b from-primary-50/60 via-transparent to-transparent
        pointer-events-none
      " />

      {/* Icon cluster */}
      <div className="relative mb-8">
        <div className="
          w-20 h-20
          rounded-2xl
          bg-gradient-to-br from-primary-400 to-primary-600
          flex items-center justify-center
          shadow-lg
          animate-pulse-soft
        ">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
        </div>
        {/* Decorative dots */}
        <div className="
          absolute -top-2 -right-2
          w-5 h-5 rounded-full
          bg-accent-400
          shadow-sm
        " />
        <div className="
          absolute -bottom-1 -left-3
          w-3 h-3 rounded-full
          bg-primary-300
        " />
      </div>

      {/* Headline */}
      <h2 className="
        text-2xl sm:text-3xl font-bold
        text-neutral-800
        mb-3
      ">
        Welcome to CareArc Coach
      </h2>
      <p className="
        text-neutral-500
        max-w-md mx-auto
        mb-8
        leading-relaxed
      ">
        Your personalized AI exercise coach is here to help you set meaningful
        recovery goals and stay on track with daily check-ins.
      </p>

      {/* CTA Button */}
      <button
        onClick={onStartOnboarding}
        disabled={loading}
        className="
          btn-accent
          px-8 py-3.5
          text-base font-semibold
          rounded-xl
          shadow-md
          hover:shadow-lg hover:scale-[1.02]
          transition-all duration-200
        "
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Starting...
          </span>
        ) : (
          'Begin Coaching'
        )}
      </button>

      {/* Feature highlights */}
      <div className="
        grid grid-cols-1 sm:grid-cols-3 gap-4
        mt-12 w-full max-w-lg
      ">
        <FeatureCard
          icon="🎯"
          title="Goal Setting"
          description="Set personalized recovery goals"
        />
        <FeatureCard
          icon="💬"
          title="Check-ins"
          description="Daily coaching conversations"
        />
        <FeatureCard
          icon="📈"
          title="Progress"
          description="Track your improvement"
        />
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="
      flex flex-col items-center
      p-4 rounded-xl
      bg-white/70
      border border-neutral-200/50
      shadow-sm
    ">
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-sm font-semibold text-neutral-700 mb-0.5">
        {title}
      </span>
      <span className="text-xs text-neutral-400">
        {description}
      </span>
    </div>
  )
}
