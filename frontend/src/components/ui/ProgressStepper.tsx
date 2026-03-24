interface Step {
  label: string
  status: 'completed' | 'active' | 'upcoming'
}

interface ProgressStepperProps {
  steps: Step[]
}

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`
              w-8 h-8 rounded-full
              flex items-center justify-center
              text-xs font-bold
              transition-all
              ${step.status === 'completed'
                ? 'bg-primary-500 text-white'
                : step.status === 'active'
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500 ring-offset-2'
                  : 'bg-neutral-100 text-neutral-400'
              }
            `}>
              {step.status === 'completed' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`
              text-[10px] font-medium mt-1.5
              ${step.status === 'active' ? 'text-primary-700' : 'text-neutral-400'}
            `}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`
              flex-1 h-0.5 mx-2 mb-5
              ${step.status === 'completed' ? 'bg-primary-400' : 'bg-neutral-200'}
            `} />
          )}
        </div>
      ))}
    </div>
  )
}
