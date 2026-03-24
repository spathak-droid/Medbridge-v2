import { useState } from 'react'
import { Confetti } from '../ui/Confetti'
import type { GoalDetails } from '../../lib/types'

interface GoalCardProps {
  goalText: string
  confirmed: boolean
  structuredGoal?: GoalDetails | null
  onConfirm: () => void
  onEdit: () => void
}

export function GoalCard({ goalText, confirmed, structuredGoal, onConfirm, onEdit }: GoalCardProps) {
  const [showConfetti, setShowConfetti] = useState(false)
  const [detailsExpanded, setDetailsExpanded] = useState(false)

  const handleConfirm = () => {
    setShowConfetti(true)
    onConfirm()
  }

  const hasDetails = structuredGoal && (
    structuredGoal.instructions ||
    structuredGoal.precautions ||
    structuredGoal.video_url
  )

  return (
    <>
      <Confetti active={showConfetti} />
      <div className="flex justify-start mb-4 ml-11 animate-fade-in-up">
        <div className="max-w-[80%] sm:max-w-[75%]">
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
            <p className="text-sm text-neutral-700 leading-relaxed mb-3">
              {goalText}
            </p>

            {/* Structured breakdown chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {extractGoalChips(goalText, structuredGoal).map((chip) => (
                <span
                  key={chip}
                  className="px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-[11px] font-medium"
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* Expandable details section */}
            {hasDetails && (
              <div className="mb-3">
                <button
                  onClick={() => setDetailsExpanded(!detailsExpanded)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${detailsExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                  {detailsExpanded ? 'Hide details' : 'View instructions & safety info'}
                </button>

                <div className={`overflow-hidden transition-all duration-300 ${
                  detailsExpanded ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                }`}>
                  {/* Instructions */}
                  {structuredGoal?.instructions && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">📋</span>
                        <h4 className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                          How to do it
                        </h4>
                      </div>
                      <div className="bg-primary-50/50 rounded-xl p-3 border border-primary-100">
                        <div className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">
                          {structuredGoal.instructions}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Precautions */}
                  {structuredGoal?.precautions && (
                    <div className="mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">⚠️</span>
                        <h4 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                          Safety & Precautions
                        </h4>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                        <div className="text-xs text-amber-900 leading-relaxed whitespace-pre-line">
                          {structuredGoal.precautions}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video link */}
                  {structuredGoal?.video_url && (
                    <div className="mb-1">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">🎬</span>
                        <h4 className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
                          Video Guide
                        </h4>
                      </div>
                      <a
                        href={structuredGoal.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                          flex items-center gap-3 p-3
                          bg-red-50 rounded-xl border border-red-100
                          hover:bg-red-100 transition-colors group
                        "
                      >
                        <div className="
                          flex-shrink-0 w-10 h-10 rounded-lg
                          bg-red-500 text-white
                          flex items-center justify-center
                          group-hover:bg-red-600 transition-colors
                        ">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-neutral-800 truncate">
                            {structuredGoal.video_title || 'Exercise Guide Video'}
                          </p>
                          <p className="text-[10px] text-neutral-500 truncate">
                            {structuredGoal.video_url}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            {confirmed ? (
              <div className="
                flex items-center gap-2
                text-sm font-semibold text-success-600
              ">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Goal confirmed!
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleConfirm} className="btn-primary px-5 py-2 text-xs">
                  Confirm Goal
                </button>
                <button onClick={onEdit} className="btn-ghost px-5 py-2 text-xs">
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function extractGoalChips(text: string, details?: GoalDetails | null): string[] {
  const chips: string[] = []

  // Use structured data if available
  if (details?.frequency && details?.frequency_unit) {
    chips.push(`${details.frequency}x/${details.frequency_unit}`)
  } else {
    const freqMatch = text.match(/(\d+)\s*(?:times?|x)\s*(?:a|per)\s*(day|week)/i)
    const dailyMatch = text.match(/\b(daily|every\s*day)\b/i)
    if (freqMatch) chips.push(`${freqMatch[1]}x/${freqMatch[2]}`)
    else if (dailyMatch) chips.push('Daily')
  }

  if (details?.duration && details?.duration_unit) {
    chips.push(`${details.duration} ${details.duration_unit}`)
  } else {
    const durationMatch = text.match(/(\d+)\s*(?:minutes?|mins?|hours?)/i)
    if (durationMatch) chips.push(`${durationMatch[1]} min`)
  }

  if (details?.video_url) {
    chips.push('Has video guide')
  }

  if (details?.instructions) {
    chips.push('Step-by-step')
  }

  // Extract activity keywords
  const activities = text.match(/(exercises?|walks?|stretching|rehab|balance|yoga|strength)/gi)
  if (activities) {
    const unique = [...new Set(activities.map(a => a.toLowerCase()))]
    chips.push(...unique.slice(0, 2))
  }

  return chips
}
