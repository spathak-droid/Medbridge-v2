import { useState } from 'react'
import type { GoalDetails } from '../lib/types'

interface GoalSummaryProps {
  goalText: string
  dateSet: string
  structuredGoal?: GoalDetails | null
}

export function GoalSummary({ goalText, dateSet, structuredGoal }: GoalSummaryProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const formattedDate = new Date(dateSet).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const hasDetails = structuredGoal && (
    structuredGoal.instructions ||
    structuredGoal.precautions ||
    structuredGoal.video_url
  )

  return (
    <div
      data-testid="goal-summary"
      className="
        border-b border-primary-100
        bg-gradient-to-r from-primary-50/80 to-white
        transition-all duration-200
      "
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="
          flex items-center gap-2.5
          w-full px-4 py-2.5
          text-left
          hover:bg-primary-50/50
          transition-colors duration-150
        "
      >
        {/* Target icon */}
        <span className="
          flex items-center justify-center
          w-6 h-6 rounded-md
          bg-primary-100
          text-primary-600
          flex-shrink-0
        ">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>

        <span className="
          flex-1 min-w-0
          text-xs font-semibold text-primary-700
          uppercase tracking-wide
        ">
          Current Goal
        </span>

        <span
          data-testid="goal-date"
          className="
            text-[11px] text-neutral-400
            whitespace-nowrap
          "
        >
          Set {formattedDate}
        </span>

        {/* Chevron */}
        <svg
          className={`
            w-4 h-4 text-neutral-400
            transition-transform duration-200
            ${collapsed ? '' : 'rotate-180'}
          `}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Collapsible content */}
      {!collapsed && (
        <div className="
          px-4 pb-3
          pl-[3.25rem]
          animate-fade-in
        ">
          <p className="text-sm text-neutral-600 leading-relaxed">
            {goalText}
          </p>

          {/* Details toggle */}
          {hasDetails && (
            <div className="mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDetails(!showDetails)
                }}
                className="text-[11px] font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
                {showDetails ? 'Hide details' : 'Instructions & safety info'}
              </button>

              {showDetails && (
                <div className="mt-2 space-y-2 animate-fade-in">
                  {structuredGoal?.instructions && (
                    <div className="bg-primary-50/60 rounded-lg p-2.5 border border-primary-100">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs">📋</span>
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">Instructions</span>
                      </div>
                      <p className="text-[11px] text-neutral-700 leading-relaxed whitespace-pre-line">
                        {structuredGoal.instructions}
                      </p>
                    </div>
                  )}

                  {structuredGoal?.precautions && (
                    <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs">⚠️</span>
                        <span className="text-[10px] font-bold text-amber-700 uppercase">Safety</span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed whitespace-pre-line">
                        {structuredGoal.precautions}
                      </p>
                    </div>
                  )}

                  {structuredGoal?.video_url && (
                    <a
                      href={structuredGoal.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                    >
                      <div className="w-7 h-7 rounded bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-neutral-700 truncate">
                          {structuredGoal.video_title || 'Exercise Guide'}
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
