export function TypingIndicator() {
  return (
    <div
      data-testid="typing-indicator"
      className="flex justify-start mb-4 animate-fade-in"
    >
      <div className="flex gap-3 items-end">
        {/* Coach avatar */}
        <div className="
          flex-shrink-0
          w-8 h-8 rounded-full
          bg-gradient-to-br from-primary-400 to-primary-600
          flex items-center justify-center
          shadow-sm
        ">
          <svg
            className="w-4.5 h-4.5 text-white"
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

        {/* Dots bubble */}
        <div className="
          rounded-2xl rounded-tl-md
          bg-white
          border border-neutral-200/60
          border-l-[3px] border-l-primary-400
          px-5 py-3.5
          shadow-card
          flex items-center gap-1.5
        ">
          <span
            className="
              w-2 h-2 rounded-full
              bg-primary-400
              animate-dot-bounce
            "
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="
              w-2 h-2 rounded-full
              bg-primary-400
              animate-dot-bounce
            "
            style={{ animationDelay: '200ms' }}
          />
          <span
            className="
              w-2 h-2 rounded-full
              bg-primary-400
              animate-dot-bounce
            "
            style={{ animationDelay: '400ms' }}
          />
        </div>
      </div>
    </div>
  )
}
