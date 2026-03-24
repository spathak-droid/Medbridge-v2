import { Link } from 'react-router-dom'
import type { ProgramSummary } from '../../lib/types'

interface ProgramOverviewCardProps {
  program: ProgramSummary
}

export function ProgramOverviewCard({ program }: ProgramOverviewCardProps) {
  return (
    <div className="flex justify-start mb-4 ml-11 animate-fade-in-up">
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className="
          rounded-2xl bg-white
          border border-neutral-200/60
          border-l-[3px] border-l-primary-400
          shadow-card p-4
        ">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📋</span>
            <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
              Your Program
            </span>
          </div>

          <h4 className="text-sm font-semibold text-neutral-800 mb-1">{program.program_name}</h4>
          <p className="text-[11px] text-neutral-400 mb-3">{program.duration_weeks} weeks | {program.exercises.length} exercises</p>

          <div className="space-y-2">
            {program.exercises.slice(0, 4).map((ex) => (
              <div key={ex.id} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <span className="text-xs text-neutral-600">{ex.name}</span>
                <span className="text-[10px] text-neutral-400 ml-auto">{ex.sets}x{ex.reps}</span>
              </div>
            ))}
            {program.exercises.length > 4 && (
              <p className="text-[11px] text-neutral-400">
                +{program.exercises.length - 4} more exercises
              </p>
            )}
          </div>

          <Link
            to="/program"
            className="
              mt-3 inline-flex items-center gap-1
              text-xs font-medium text-primary-600
              hover:text-primary-700
            "
          >
            View full program
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
