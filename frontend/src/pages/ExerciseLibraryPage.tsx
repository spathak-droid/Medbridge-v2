import { useEffect, useState } from 'react'
import { getProgramsLibrary } from '../lib/api'
import type { ProgramSummary, Exercise } from '../lib/types'
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton'

export function ExerciseLibraryPage() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPrograms = () => {
    setError(null)
    setLoading(true)
    getProgramsLibrary()
      .then((p) => {
        setPrograms(p)
        if (p.length > 0) setSelectedProgram(p[0].program_type)
      })
      .catch((err) => setError(err.message || 'Failed to load exercise programs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPrograms()
  }, [])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSkeleton variant="card" count={4} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPrograms}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentProgram = programs.find(p => p.program_type === selectedProgram)

  // Collect all exercises across all programs for search
  const allExercises: (Exercise & { programName: string })[] = programs.flatMap(p =>
    p.exercises.map(e => ({ ...e, programName: p.program_name }))
  )

  const filteredExercises = search.trim()
    ? allExercises.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.muscle_groups.some(mg => mg.toLowerCase().includes(search.toLowerCase())) ||
        e.description.toLowerCase().includes(search.toLowerCase())
      )
    : null

  const difficultyColor = (d: string) =>
    d === 'beginner' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'

  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-800">Exercise Library</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Browse all available rehabilitation programs and exercises
          </p>
        </div>
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="pl-9 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full sm:w-64"
          />
        </div>
      </div>

      {/* Search results mode */}
      {filteredExercises ? (
        <div>
          <p className="text-sm text-neutral-500 mb-4">
            {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExercises.map((ex) => (
              <ExerciseCard
                key={`${ex.programName}-${ex.id}`}
                exercise={ex}
                expanded={expandedExercise === `${ex.programName}-${ex.id}`}
                onToggle={() => setExpandedExercise(
                  expandedExercise === `${ex.programName}-${ex.id}` ? null : `${ex.programName}-${ex.id}`
                )}
                difficultyColor={difficultyColor}
                showProgram={ex.programName}
              />
            ))}
          </div>
          {filteredExercises.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-neutral-400">No exercises match your search</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Program tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {programs.map((p) => (
              <button
                key={p.program_type}
                onClick={() => setSelectedProgram(p.program_type)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                  transition-all cursor-pointer
                  ${selectedProgram === p.program_type
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }
                `}
              >
                {p.program_name}
              </button>
            ))}
          </div>

          {/* Program details */}
          {currentProgram && (
            <div>
              {/* Program header card */}
              <div className="card p-5 mb-6 border-l-4 border-l-primary-500">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-neutral-800">{currentProgram.program_name}</h2>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="flex items-center gap-1.5 text-sm text-neutral-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                        </svg>
                        {currentProgram.duration_weeks} weeks
                      </span>
                      <span className="flex items-center gap-1.5 text-sm text-neutral-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                        </svg>
                        {currentProgram.exercises.length} exercises
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exercise grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {currentProgram.exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    expanded={expandedExercise === ex.id}
                    onToggle={() => setExpandedExercise(expandedExercise === ex.id ? null : ex.id)}
                    difficultyColor={difficultyColor}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  expanded,
  onToggle,
  difficultyColor,
  showProgram,
}: {
  exercise: Exercise
  expanded: boolean
  onToggle: () => void
  difficultyColor: (d: string) => string
  showProgram?: string
}) {
  return (
    <div className="card overflow-hidden transition-shadow hover:shadow-md">
      <button
        onClick={onToggle}
        className="w-full text-left p-5 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <h3 className="text-sm font-semibold text-neutral-800">{exercise.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${difficultyColor(exercise.difficulty)}`}>
                {exercise.difficulty}
              </span>
            </div>
            {showProgram && (
              <p className="text-[10px] text-primary-600 font-medium mb-1">{showProgram}</p>
            )}
            <p className="text-xs text-neutral-500 line-clamp-2">{exercise.description}</p>
          </div>
          <svg
            className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[11px] text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
            {exercise.sets} sets x {exercise.reps} reps
          </span>
          {exercise.hold_time_seconds > 0 && (
            <span className="text-[11px] text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
              {exercise.hold_time_seconds}s hold
            </span>
          )}
          <span className="text-[11px] text-neutral-500 bg-neutral-50 px-2 py-1 rounded">
            {exercise.frequency}
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-neutral-100 pt-4 space-y-3">
          {/* Muscle groups */}
          <div>
            <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Muscle Groups</h4>
            <div className="flex gap-1.5 flex-wrap">
              {exercise.muscle_groups.map(mg => (
                <span key={mg} className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-medium">
                  {mg}
                </span>
              ))}
            </div>
          </div>

          {/* Tips */}
          {exercise.tips && (
            <div>
              <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Tips</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">{exercise.tips}</p>
            </div>
          )}

          {/* Precautions */}
          {exercise.precautions && (
            <div>
              <h4 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">Precautions</h4>
              <p className="text-xs text-amber-700 leading-relaxed bg-amber-50 rounded-lg p-2.5">{exercise.precautions}</p>
            </div>
          )}

          {/* Video link */}
          {exercise.video_url && (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              {exercise.video_title || 'Watch Video Guide'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
