import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const checkRef = useRef<SVGSVGElement>(null)

  const animateTransition = (next: number) => {
    if (!contentRef.current) return
    const direction = next > step ? 1 : -1
    gsap.to(contentRef.current, {
      opacity: 0,
      x: direction * -60,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        setStep(next)
        gsap.fromTo(
          contentRef.current!,
          { opacity: 0, x: direction * 60 },
          { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' },
        )
      },
    })
  }

  const handleComplete = () => {
    localStorage.setItem('onboarding_complete', 'true')
    onComplete()
  }

  // Animate checkmark on step 3
  useEffect(() => {
    if (step === 2 && checkRef.current) {
      gsap.fromTo(
        checkRef.current,
        { scale: 0, rotation: -90 },
        { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.7)', delay: 0.15 },
      )
    }
  }, [step])

  // Entrance animation
  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      )
    }
  }, [])

  const features = [
    {
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
      title: 'Dashboard',
      description: 'Track your daily progress at a glance',
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      ),
      title: 'AI Coach',
      description: 'Get personalized guidance from your AI rehab coach',
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
      ),
      title: 'Exercise Program',
      description: 'Follow video-guided exercises tailored for you',
    },
    {
      icon: (
        <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      ),
      title: 'Progress Tracking',
      description: 'See your adherence, streaks, and milestones',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div ref={contentRef} className="w-full max-w-lg px-6 py-10 flex flex-col items-center text-center">
        {/* Step 1 - Welcome */}
        {step === 0 && (
          <>
            {/* Heart icon / logo */}
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-neutral-800 mb-2">Welcome to CareArc!</h1>
            <p className="text-base text-neutral-500 mb-10">Your AI-powered rehabilitation coach</p>
            <button
              onClick={() => animateTransition(1)}
              className="w-full max-w-xs py-3 rounded-xl bg-blue-500 text-white font-semibold text-base hover:bg-blue-600 transition-colors cursor-pointer"
            >
              Get Started
            </button>
          </>
        )}

        {/* Step 2 - Features Tour */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-bold text-neutral-800 mb-2">What you can do</h2>
            <p className="text-sm text-neutral-500 mb-8">Everything you need for your recovery</p>
            <div className="grid grid-cols-2 gap-4 w-full mb-10">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-neutral-200 p-4 flex flex-col items-center text-center gap-2"
                >
                  {f.icon}
                  <p className="text-sm font-bold text-neutral-800">{f.title}</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => animateTransition(2)}
              className="w-full max-w-xs py-3 rounded-xl bg-blue-500 text-white font-semibold text-base hover:bg-blue-600 transition-colors cursor-pointer"
            >
              Next
            </button>
          </>
        )}

        {/* Step 3 - Ready */}
        {step === 2 && (
          <>
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
              <svg
                ref={checkRef}
                className="w-10 h-10 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                style={{ transformOrigin: 'center' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-neutral-800 mb-2">You're all set!</h1>
            <p className="text-base text-neutral-500 mb-10">Your recovery journey starts now</p>
            <button
              onClick={handleComplete}
              className="w-full max-w-xs py-3 rounded-xl bg-blue-500 text-white font-semibold text-base hover:bg-blue-600 transition-colors cursor-pointer"
            >
              Start your recovery journey
            </button>
          </>
        )}
      </div>

      {/* Step indicators */}
      <div className="absolute bottom-10 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              i === step ? 'bg-blue-500' : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
