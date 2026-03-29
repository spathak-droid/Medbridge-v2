import { useNavigate } from 'react-router-dom'
import { useRef, useState } from 'react'

export function LandingPage() {
  const navigate = useNavigate()
  const howRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen font-sans overflow-x-hidden">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden" style={{
        background: 'linear-gradient(160deg, #001c3a 0%, #003366 25%, #004785 50%, #0059a4 75%, #005fae 100%)',
      }}>
        {/* Decorative — hidden on mobile */}
        <div className="hidden lg:block absolute w-[500px] h-[500px] rounded-full border border-white/10 pointer-events-none top-[10%] left-1/2 -translate-x-1/2" />
        <div className="hidden lg:block absolute w-[360px] h-[360px] rounded-full border border-white/15 pointer-events-none top-[14%] left-1/2 -translate-x-1/2" />
        <div className="hidden md:block absolute w-[120px] h-[120px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(165,200,255,0.3) 0%, transparent 70%)', right: '10%', top: '15%' }} />
        <div className="hidden md:block absolute w-[80px] h-[80px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(77,145,240,0.25) 0%, transparent 70%)', left: '12%', bottom: '30%' }} />

        {/* Wave */}
        <svg className="absolute bottom-0 left-0 w-full h-16 md:h-24" viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0 60 Q360 0 720 40 Q1080 80 1440 20 L1440 100 L0 100 Z" fill="white" />
        </svg>

        {/* Navbar */}
        <nav className="relative z-20 flex items-center justify-between px-5 md:px-10 lg:px-15 h-16 md:h-18">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-white text-xl md:text-[22px] font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-brand)' }}>CareArc</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 bg-white/25 backdrop-blur-md rounded-3xl px-2 py-1.5 shadow-md">
            <button className="px-4 py-2 rounded-2xl bg-white text-primary-700 text-sm font-semibold cursor-pointer">Home</button>
            <button onClick={() => scrollTo(howRef)} className="px-4 py-2 rounded-2xl text-white/90 text-sm font-medium hover:bg-white/10 transition cursor-pointer">How It Works</button>
            <button onClick={() => scrollTo(featuresRef)} className="px-4 py-2 rounded-2xl text-white/90 text-sm font-medium hover:bg-white/10 transition cursor-pointer">Features</button>
            <button onClick={() => navigate('/findings')} className="px-4 py-2 rounded-2xl text-white/90 text-sm font-medium hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              Findings
            </button>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate('/patient/login')} className="px-5 py-2.5 rounded-3xl border-[1.5px] border-white/50 text-white text-sm font-semibold hover:bg-white/10 transition cursor-pointer">
              Patient Login
            </button>
            <button onClick={() => navigate('/clinician/login')} className="px-5 py-2.5 rounded-3xl bg-white/20 backdrop-blur-sm border-[1.5px] border-white/30 text-white text-sm font-semibold hover:bg-white/30 transition cursor-pointer">
              Clinician Login
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 flex items-center justify-center text-white cursor-pointer">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              }
            </svg>
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden relative z-20 mx-5 bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-4 flex flex-col gap-2">
            <button onClick={() => scrollTo(howRef)} className="px-4 py-3 rounded-xl text-white font-medium hover:bg-white/10 transition text-left cursor-pointer">How It Works</button>
            <button onClick={() => scrollTo(featuresRef)} className="px-4 py-3 rounded-xl text-white font-medium hover:bg-white/10 transition text-left cursor-pointer">Features</button>
            <button onClick={() => { navigate('/findings'); setMenuOpen(false) }} className="px-4 py-3 rounded-xl text-white font-medium hover:bg-white/10 transition text-left cursor-pointer flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              Findings
            </button>
            <button onClick={() => { navigate('/patient/login'); setMenuOpen(false) }} className="px-4 py-3 rounded-xl bg-white text-primary-700 font-semibold text-center cursor-pointer">Patient Login</button>
            <button onClick={() => { navigate('/clinician/login'); setMenuOpen(false) }} className="px-4 py-3 rounded-xl bg-white/80 text-primary-700 font-semibold text-center cursor-pointer">Clinician Login</button>
          </div>
        )}

        {/* Hero content — flex-based, not absolute */}
        <div className="relative z-10 flex flex-col items-center px-5 md:px-10 pt-10 md:pt-16 pb-28 md:pb-36">
          {/* Coach avatar */}
          <div className="w-36 h-36 md:w-52 md:h-52 lg:w-64 lg:h-64 rounded-full bg-gradient-to-br from-white/30 to-white/10 border border-white/30 flex flex-col items-center justify-center shadow-[0_8px_40px_rgba(0,0,0,0.12)] mb-8 md:mb-10">
            <svg className="w-14 h-14 md:w-20 md:h-20 text-white/80" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span className="text-white/90 text-sm md:text-base font-bold mt-1">AI Coach</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-white text-center leading-tight tracking-tight">
            Your AI-Powered<br />
            <span className="bg-gradient-to-b from-white to-blue-200 bg-clip-text text-transparent">Rehab Coach</span>
          </h1>

          <p className="text-white/80 text-base md:text-lg text-center max-w-[620px] leading-relaxed mt-5 md:mt-6 px-4">
            Daily motivation, goal tracking, and accountability — so patients stay on track between visits.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mt-8">
            <button
              onClick={() => navigate('/patient/signup')}
              className="flex items-center gap-2 px-7 py-3.5 md:px-8 md:py-4 bg-white rounded-[28px] text-primary-700 text-base font-bold shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Free Trial
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
            <button
              onClick={() => scrollTo(howRef)}
              className="flex items-center gap-2 px-7 py-3.5 md:px-8 md:py-4 rounded-[28px] border-[1.5px] border-white/50 text-white text-base font-semibold hover:bg-white/10 transition cursor-pointer"
            >
              <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch Demo
            </button>
          </div>

          {/* Trust badges — row on desktop, stack on mobile */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl px-4 py-2.5 flex items-center gap-2.5 shadow-lg">
              <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-.001m5.94.001v5.94" />
              </svg>
              <div>
                <div className="text-white text-sm font-bold">76% Adherence</div>
                <div className="text-white/60 text-xs">Patient avg.</div>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
              <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span className="text-white text-sm font-semibold">HIPAA Compliant</span>
            </div>
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-lg">
              <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span className="text-white text-sm font-semibold">2,400+ Providers</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section ref={howRef} className="bg-white px-5 md:px-10 lg:px-20 xl:px-30 py-16 md:py-20 flex flex-col items-center gap-8 md:gap-12">
        <div className="px-4 py-1.5 bg-primary-50 rounded-2xl">
          <span className="text-primary-700 text-[13px] font-semibold">How It Works</span>
        </div>
        <h2 className="text-3xl md:text-[40px] font-extrabold text-neutral-900 text-center leading-tight">Three steps to better outcomes</h2>
        <p className="text-neutral-500 text-base md:text-[17px] text-center max-w-[560px] leading-relaxed">
          CareArc Coach automates patient engagement so clinicians can focus on care.
        </p>

        <div className="flex flex-col md:flex-row gap-5 md:gap-8 w-full max-w-[1200px]">
          {[
            { num: '1', title: 'Patient Onboards', desc: 'Patient consents and sets a personal exercise goal through a guided conversation.' },
            { num: '2', title: 'Coach Engages', desc: 'AI sends motivational check-ins at Day 2, 5, and 7 — adapting tone to patient progress.' },
            { num: '3', title: 'Clinician Stays Informed', desc: 'Real-time alerts for disengagement or crisis signals. No patient falls through the cracks.' },
          ].map((step) => (
            <div key={step.num} className="flex-1 bg-primary-50/50 border border-primary-100 rounded-2xl p-6 md:p-8 flex flex-col items-center gap-4 md:gap-5 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-xl font-extrabold">{step.num}</span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 text-center">{step.title}</h3>
              <p className="text-sm text-neutral-500 text-center leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section ref={featuresRef} className="bg-primary-50/40 px-5 md:px-10 lg:px-20 xl:px-30 py-16 md:py-20 flex flex-col items-center gap-8 md:gap-12">
        <div className="px-4 py-1.5 bg-white rounded-2xl">
          <span className="text-primary-700 text-[13px] font-semibold">Built for Healthcare</span>
        </div>
        <h2 className="text-3xl md:text-[40px] font-extrabold text-neutral-900 text-center leading-tight">Everything patients and clinicians need</h2>

        <div className="flex flex-col md:flex-row gap-5 md:gap-6 w-full max-w-[1200px]">
          {[
            { icon: '🎯', iconBg: 'bg-primary-50', title: 'Smart Goal Setting', desc: 'AI extracts structured goals from natural conversation and tracks progress automatically.' },
            { icon: '🛡️', iconBg: 'bg-orange-50', title: 'Safety Guardrails', desc: 'Every message passes through a clinical safety classifier. Crisis signals trigger instant clinician alerts.' },
            { icon: '🔔', iconBg: 'bg-purple-50', title: 'Smart Follow-Ups', desc: 'Automated Day 2, 5, 7 check-ins with tone that adapts — celebration, nudge, or gentle reminder.' },
          ].map((feat) => (
            <div key={feat.title} className="flex-1 bg-white rounded-2xl p-6 md:p-7 flex flex-col gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-lg transition-shadow">
              <div className={`w-12 h-12 ${feat.iconBg} rounded-[14px] flex items-center justify-center text-2xl shrink-0`}>
                {feat.icon}
              </div>
              <h3 className="text-base font-bold text-neutral-900">{feat.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="px-5 md:px-10 lg:px-30 py-16 md:py-24 flex flex-col items-center gap-5 md:gap-6" style={{
        background: 'linear-gradient(160deg, #003366 0%, #0059a4 50%, #4d91f0 100%)',
      }}>
        <h2 className="text-3xl md:text-[40px] font-extrabold text-white text-center leading-tight">Ready to reduce patient drop-off?</h2>
        <p className="text-white/80 text-base md:text-[17px] text-center max-w-[500px] leading-relaxed">
          Join 2,400+ providers already using CareArc Coach.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mt-4">
          <button
            onClick={() => navigate('/patient/signup')}
            className="flex items-center gap-2 px-8 py-3.5 md:py-4 bg-white rounded-[28px] text-primary-700 text-base font-bold shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.18)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Free Trial
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <button className="px-8 py-3.5 md:py-4 rounded-[28px] border-[1.5px] border-white/50 text-white text-base font-semibold hover:bg-white/10 transition cursor-pointer">
            Book a Demo
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-neutral-900 px-5 md:px-10 lg:px-30 py-12 md:py-16">
        <div className="flex flex-col md:flex-row justify-between items-start gap-10 max-w-[1200px] mx-auto">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-primary-600 rounded-[10px] flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <span className="text-white text-lg font-bold" style={{ fontFamily: 'var(--font-brand)' }}>CareArc</span>
            </div>
            <p className="text-neutral-400 text-sm max-w-[280px] leading-relaxed">AI-powered rehabilitation coaching that keeps patients engaged between visits.</p>
          </div>
          <div className="flex gap-12 md:gap-20">
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Product</h4>
              <div className="flex flex-col gap-2.5">
                <button onClick={() => scrollTo(featuresRef)} className="text-neutral-400 text-sm hover:text-white transition cursor-pointer text-left">Features</button>
                <button onClick={() => scrollTo(howRef)} className="text-neutral-400 text-sm hover:text-white transition cursor-pointer text-left">How It Works</button>
                <button onClick={() => navigate('/patient/signup')} className="text-neutral-400 text-sm hover:text-white transition cursor-pointer text-left">Try It Free</button>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Company</h4>
              <div className="flex flex-col gap-2.5">
                <span className="text-neutral-400 text-sm">About</span>
                <span className="text-neutral-400 text-sm">Privacy Policy</span>
                <span className="text-neutral-400 text-sm">Terms of Service</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-800 mt-10 md:mt-12 pt-6 max-w-[1200px] mx-auto">
          <p className="text-neutral-500 text-xs text-center">&copy; 2025 CareArc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
