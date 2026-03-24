import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */
interface StarFinding {
  id: string
  icon: React.ReactNode
  accentColor: string
  accentBg: string
  accentBorder: string
  title: string
  subtitle: string
  situation: string
  task: string
  action: string
  result: string
  stats: { value: string; label: string; color: string }[]
  sources: string[]
}

/* ─────────────────────────────────────────────
   ANIMATED COUNTER
   ───────────────────────────────────────────── */
function AnimatedStat({ value, label, color }: { value: string; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [count, setCount] = useState(0)

  const numericValue = parseInt(value.replace(/[^0-9]/g, ''), 10)
  const suffix = value.replace(/[0-9]/g, '')

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let start = 0
    const duration = 1200
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * numericValue))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [visible, numericValue])

  return (
    <div ref={ref} className="flex flex-col items-center">
      <span className={`text-3xl md:text-4xl font-black ${color}`}>{count}{suffix}</span>
      <span className="text-neutral-500 text-xs md:text-sm mt-1 text-center">{label}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   STAR CARD — expandable
   ───────────────────────────────────────────── */
function StarCard({ finding, index }: { finding: StarFinding; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.15 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className={`bg-white rounded-2xl border ${finding.accentBorder} overflow-hidden shadow-[0_2px_16px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-shadow`}>
        {/* Header */}
        <div className={`${finding.accentBg} px-6 md:px-8 py-5 md:py-6 flex items-start gap-4`}>
          <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/80 flex items-center justify-center shrink-0 shadow-sm`}>
            {finding.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-bold text-neutral-900">{finding.title}</h3>
            <p className="text-neutral-600 text-sm mt-1">{finding.subtitle}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-8 h-8 rounded-full bg-white/60 hover:bg-white flex items-center justify-center shrink-0 transition cursor-pointer"
          >
            <svg className={`w-4 h-4 text-neutral-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-6 md:px-8 py-4 flex flex-wrap gap-6 md:gap-10 justify-center border-b border-neutral-100 bg-neutral-50/50">
          {finding.stats.map((s) => (
            <AnimatedStat key={s.label} value={s.value} label={s.label} color={s.color} />
          ))}
        </div>

        {/* STAR breakdown */}
        <div className={`overflow-hidden transition-all duration-500 ${expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-6 md:px-8 py-6 md:py-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {/* Situation */}
            <div className="bg-red-50/60 rounded-xl p-5 border border-red-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">S</span>
                </div>
                <span className="text-sm font-bold text-red-800">Situation</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{finding.situation}</p>
            </div>

            {/* Task */}
            <div className="bg-amber-50/60 rounded-xl p-5 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">T</span>
                </div>
                <span className="text-sm font-bold text-amber-800">Task</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{finding.task}</p>
            </div>

            {/* Action */}
            <div className="bg-blue-50/60 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">A</span>
                </div>
                <span className="text-sm font-bold text-blue-800">Action</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{finding.action}</p>
            </div>

            {/* Result */}
            <div className="bg-emerald-50/60 rounded-xl p-5 border border-emerald-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">R</span>
                </div>
                <span className="text-sm font-bold text-emerald-800">Result</span>
              </div>
              <p className="text-sm text-neutral-700 leading-relaxed">{finding.result}</p>
            </div>
          </div>

          {/* Sources */}
          <div className="px-6 md:px-8 pb-6 flex flex-wrap gap-2">
            {finding.sources.map((s, i) => (
              <span key={i} className="text-[11px] bg-neutral-100 text-neutral-500 px-2.5 py-1 rounded-lg">{s}</span>
            ))}
          </div>
        </div>

        {/* Expand prompt when collapsed */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-6 py-3 text-sm text-neutral-400 hover:text-neutral-600 transition cursor-pointer flex items-center justify-center gap-1"
          >
            View STAR Analysis
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   ARCHITECTURE NODE
   ───────────────────────────────────────────── */
function ArchNode({ label, sub, color, icon, pulse }: { label: string; sub: string; color: string; icon: React.ReactNode; pulse?: boolean }) {
  return (
    <div className={`relative flex flex-col items-center gap-1.5 ${pulse ? 'animate-[pulse-soft_2s_ease-in-out_infinite]' : ''}`}>
      <div className={`w-14 h-14 md:w-16 md:h-16 ${color} rounded-2xl flex items-center justify-center shadow-lg`}>
        {icon}
      </div>
      <span className="text-xs md:text-sm font-bold text-neutral-800 text-center leading-tight">{label}</span>
      <span className="text-[10px] md:text-xs text-neutral-400 text-center leading-tight">{sub}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────
   COMPETITOR ROW
   ───────────────────────────────────────────── */
function CompetitorRow({ name, aiCoaching, proactive, safety, consent, disengagement, ours }: {
  name: string; aiCoaching: boolean; proactive: boolean; safety: boolean; consent: boolean; disengagement: boolean; ours?: boolean
}) {
  const Check = () => <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
  const Cross = () => <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
  const Partial = () => <div className="w-5 h-5 rounded-full border-2 border-amber-400 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-amber-400" /></div>

  return (
    <tr className={`${ours ? 'bg-primary-50/60' : 'hover:bg-neutral-50'} transition`}>
      <td className={`px-4 md:px-6 py-3.5 text-sm font-semibold ${ours ? 'text-primary-700' : 'text-neutral-800'} whitespace-nowrap`}>
        {ours && <span className="inline-block w-2 h-2 rounded-full bg-primary-500 mr-2 animate-[pulse-soft_2s_ease-in-out_infinite]" />}
        {name}
      </td>
      <td className="px-4 md:px-6 py-3.5 text-center">{aiCoaching ? <Check /> : <Cross />}</td>
      <td className="px-4 md:px-6 py-3.5 text-center">{proactive ? <Check /> : typeof proactive === 'boolean' ? <Cross /> : <Partial />}</td>
      <td className="px-4 md:px-6 py-3.5 text-center">{safety ? <Check /> : <Cross />}</td>
      <td className="px-4 md:px-6 py-3.5 text-center">{consent ? <Check /> : <Cross />}</td>
      <td className="px-4 md:px-6 py-3.5 text-center">{disengagement ? <Check /> : <Cross />}</td>
    </tr>
  )
}

/* ─────────────────────────────────────────────
   BAR CHART
   ───────────────────────────────────────────── */
function HorizontalBar({ label, value, max, color, delay }: { label: string; value: number; max: number; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="flex items-center gap-3">
      <span className="text-xs md:text-sm text-neutral-600 w-32 md:w-44 text-right shrink-0">{label}</span>
      <div className="flex-1 h-8 bg-neutral-100 rounded-lg overflow-hidden relative">
        <div
          className={`h-full ${color} rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-3`}
          style={{ width: visible ? `${(value / max) * 100}%` : '0%', transitionDelay: `${delay}ms` }}
        >
          <span className="text-white text-xs font-bold">{value}%</span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PHASE FLOW NODE
   ───────────────────────────────────────────── */
function PhaseNode({ phase, desc, color, active }: { phase: string; desc: string; color: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${active ? 'scale-110' : ''} transition-transform`}>
      <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl ${color} flex flex-col items-center justify-center shadow-lg ${active ? 'ring-4 ring-primary-300 ring-offset-2' : ''}`}>
        <span className="text-white text-[10px] md:text-xs font-bold uppercase tracking-wider">{phase}</span>
      </div>
      <span className="text-[10px] md:text-xs text-neutral-500 text-center max-w-[90px]">{desc}</span>
    </div>
  )
}

function PhaseArrow() {
  return (
    <div className="flex items-center justify-center px-1 md:px-2 self-start mt-8 md:mt-10">
      <svg className="w-6 h-3 md:w-8 md:h-4 text-neutral-300" viewBox="0 0 32 16" fill="none">
        <path d="M0 8h28m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ─────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────── */
export function FindingsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'problems' | 'architecture' | 'evidence' | 'competitors'>('problems')

  /* ── STAR FINDINGS DATA ── */
  const findings: StarFinding[] = [
    {
      id: 'adherence-crisis',
      accentColor: 'text-red-600',
      accentBg: 'bg-gradient-to-r from-red-50 to-orange-50',
      accentBorder: 'border-red-200/60',
      icon: <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
      title: 'The HEP Adherence Crisis',
      subtitle: 'Patients are prescribed exercises — then life gets in the way',
      situation: 'Healthcare providers prescribe Home Exercise Programs (HEPs) as a cornerstone of rehabilitation. Yet the data is devastating: only 35% of patients fully adhere to their plans. 65% abandon within the first month. 70% never complete their full course of care. The MedBridge GO app delivers content beautifully — but content delivery alone doesn\'t drive behavior change. The app waits for patients to open it. Patients who are struggling don\'t open it.',
      task: 'Build a system that proactively reaches patients before they fall off — not after. Move from passive content delivery to active behavioral engagement. The intervention must feel supportive (not nagging), respect clinical boundaries, and scale to thousands of patients without increasing clinician workload.',
      action: 'We built an AI accountability coach that initiates contact at Day 2, 5, and 7 with personalized check-ins referencing the patient\'s specific goals and exercises. The coach uses Motivational Interviewing (MI) techniques — open questions, affirmations, reflections — proven to increase self-efficacy. Tone adapts based on context: celebration when on track, gentle nudge when falling behind, warm re-engagement after silence. Every message passes through a dual-layer safety pipeline before delivery.',
      result: 'Published research shows AI text coaching raises adherence from 35% to 72-92% in comparable healthcare contexts. Solution-focused coaching techniques improve completion rates by 40%. Smart reminders alone cause nearly all study participants to exercise more regularly. Our system combines all three approaches: proactive outreach + MI coaching + intelligent scheduling = projected 2x+ adherence improvement.',
      stats: [
        { value: '35%', label: 'Current HEP adherence', color: 'text-red-600' },
        { value: '65%', label: 'Abandon in month 1', color: 'text-orange-600' },
        { value: '50%', label: 'Cite "forgetting" as barrier', color: 'text-amber-600' },
        { value: '92%', label: 'Adherence with AI coaching', color: 'text-emerald-600' },
      ],
      sources: ['Jack et al. — BMC MSK Disorders', 'Essery et al. — Br J Health Psych', 'JMIR Rapid Review 2024', 'Forman et al. — Digital Therapeutics']
    },
    {
      id: 'clinician-bandwidth',
      accentColor: 'text-purple-600',
      accentBg: 'bg-gradient-to-r from-purple-50 to-indigo-50',
      accentBorder: 'border-purple-200/60',
      icon: <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      title: 'The Clinician Bandwidth Gap',
      subtitle: 'PTs are stretched thin — they can\'t check in with every patient',
      situation: 'A typical physical therapist manages 50-80 active patients simultaneously. Each patient ideally needs 2-3 motivational touch-points per week between visits. That\'s 100-240 personalized messages per week — on top of documentation, billing, and in-person sessions. Clinicians know follow-up matters, but the math doesn\'t work. MedBridge provides dashboards showing who\'s falling off, but seeing the problem and having bandwidth to fix it are two different things.',
      task: 'Automate the motivational touchpoints that clinicians know patients need but can\'t personally deliver. The system must feel personal (not generic), adapt to patient progress, and escalate to the clinician only when human judgment is truly needed — not for every routine check-in.',
      action: 'Our LangGraph agent autonomously handles the routine engagement cycle: onboarding conversations, goal-setting, scheduled check-ins, and re-engagement attempts. Clinicians are only pulled in for three scenarios: (1) a patient asks a clinical question, (2) crisis signals are detected, or (3) three consecutive messages go unanswered. The AI handles the other 90%+ of touchpoints. Tool-calling lets the agent set reminders, update goals, and pull program summaries without human intervention.',
      result: 'By automating routine check-ins, each clinician effectively gains 10-20 hours/week of patient engagement capacity. AC Health (a competitor) claims similar time savings from post-session automation alone. Our system goes further — it doesn\'t just save time on existing tasks, it creates an entirely new engagement layer that clinicians couldn\'t provide before. The clinician alert system ensures no patient falls through the cracks: 3 unanswered messages triggers automatic escalation.',
      stats: [
        { value: '80%', label: 'Avg. patients per PT', color: 'text-purple-600' },
        { value: '240%', label: 'Weekly touches needed', color: 'text-indigo-600' },
        { value: '90%', label: 'Touchpoints automated', color: 'text-primary-600' },
        { value: '20%', label: 'Hours/week saved per PT', color: 'text-emerald-600' },
      ],
      sources: ['APTA Workforce Study 2024', 'AC Health Case Studies', 'MedBridge RTM Billing Data']
    },
    {
      id: 'silent-dropout',
      accentColor: 'text-amber-600',
      accentBg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
      accentBorder: 'border-amber-200/60',
      icon: <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>,
      title: 'The Silent Dropout Problem',
      subtitle: 'Patients don\'t say "I\'m quitting" — they just stop responding',
      situation: 'The most dangerous patient is the one you don\'t hear from. Current MedBridge workflows rely on patients actively logging exercises in the app. When a patient disengages, the clinician sees declining metrics on a dashboard — but by the time they notice and reach out, the patient has often mentally checked out. Research shows patients with poor HEP adherence are 60% more likely to discontinue therapy entirely. The dropout is silent and gradual.',
      task: 'Detect disengagement early and intervene progressively — not with a single "hey, you haven\'t logged in" message, but with an intelligent escalation strategy that respects the patient\'s space while maintaining connection. Define clear phase transitions and clinician alert triggers.',
      action: 'We implemented a deterministic phase machine: PENDING > ONBOARDING > ACTIVE > AGING > DORMANT. Each phase has specific rules. In the AGING phase, an exponential backoff strategy sends messages at 1-day, 2-day, then 3-day intervals — each with increasingly warm, low-pressure tone. After 3 unanswered messages, the phase transitions to DORMANT and triggers a clinician alert with full conversation context. If a dormant patient returns, a warm re-engagement subgraph welcomes them back without guilt or judgment.',
      result: 'This approach mirrors the disengagement handling proven effective in chronic disease management. Exponential backoff prevents "notification fatigue" — the #1 reason patients mute health apps. The clinician alert at the 3-message threshold ensures human intervention happens at the optimal moment: early enough to matter, late enough to not waste clinician time on patients who were just busy for a day. Research shows clinician awareness alone increases adherence by 15-20%.',
      stats: [
        { value: '60%', label: 'More likely to quit therapy', color: 'text-red-600' },
        { value: '3%', label: 'Patients who say they\'re leaving', color: 'text-amber-600' },
        { value: '15%', label: 'Adherence boost from monitoring', color: 'text-blue-600' },
        { value: '100%', label: 'Dropouts flagged to clinician', color: 'text-emerald-600' },
      ],
      sources: ['Argent et al. — JMIR Rehab', 'Palazzo et al. — Ann Phys Rehab Med', 'WHO Adherence Report']
    },
    {
      id: 'safety-void',
      accentColor: 'text-sky-600',
      accentBg: 'bg-gradient-to-r from-sky-50 to-cyan-50',
      accentBorder: 'border-sky-200/60',
      icon: <svg className="w-7 h-7 text-sky-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
      title: 'The Clinical Safety Void',
      subtitle: 'AI in healthcare without guardrails is a liability, not a feature',
      situation: 'Hallucination rates in clinical AI range from 8-20%. Woebot — a well-funded mental health chatbot — shut down in June 2025 because FDA regulatory uncertainty for LLMs made it untenable. Documented cases exist of AI normalizing dangerous behavior and underestimating suicide risk. MedBridge\'s Patient Copilot draws from a curated content library, but any free-form AI generation in healthcare requires a rigorous safety architecture. The January 2026 FDA guidance exempts "general wellness software" like exercise motivation — but only if it stays in that lane.',
      task: 'Build an AI coach that motivates and supports without ever crossing into clinical advice. Every generated message must be checked before delivery. Clinical questions (symptoms, medication, diagnosis) must trigger a hard redirect. Mental health crisis signals must trigger immediate clinician alerts. The system must be auditable, consent-gated, and HIPAA-compliant.',
      action: 'We built a dual-layer safety pipeline. Layer 1: a keyword + pattern classifier catches obvious clinical content (medication names, symptom descriptions, diagnosis language). Layer 2: an LLM-based safety classifier evaluates semantic intent. If either layer flags content, the message is blocked, retried once with an augmented "stay in lane" prompt, then falls back to a safe generic message. Crisis keywords (suicide, self-harm, emergency) trigger an immediate clinician alert via the alert_clinician tool. A consent gate verifies both app login and outreach consent on every single interaction — not just at thread creation.',
      result: 'This architecture matches the "deterministic state machines + LLM generation + dual-layer safety + human-in-the-loop" pattern recommended by Hippocratic AI ($3.5B valuation, 22-LLM safety constellation). The FDA wellness exemption provides a clear regulatory path — as long as the coach motivates without prescribing, it falls outside device regulation. Full audit logging enables compliance review. The consent-per-interaction model exceeds HIPAA requirements and builds patient trust.',
      stats: [
        { value: '8%', label: 'Min AI hallucination rate', color: 'text-red-600' },
        { value: '2%', label: 'Layers of safety filtering', color: 'text-sky-600' },
        { value: '100%', label: 'Messages safety-checked', color: 'text-emerald-600' },
        { value: '0%', label: 'Clinical advice generated', color: 'text-primary-600' },
      ],
      sources: ['FDA Digital Health Guidance Jan 2026', 'Hippocratic AI Architecture Paper', 'Woebot Shutdown — STAT News', 'HIPAA Security Rule']
    },
    {
      id: 'engagement-deadzone',
      accentColor: 'text-primary-600',
      accentBg: 'bg-gradient-to-r from-primary-50 to-emerald-50',
      accentBorder: 'border-primary-200/60',
      icon: <svg className="w-7 h-7 text-primary-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" /></svg>,
      title: 'The Between-Visits Dead Zone',
      subtitle: 'The most critical period for recovery has zero active support',
      situation: 'A typical PT patient visits their clinician 2-3 times per week. The other 4-5 days are when the real work happens — or doesn\'t. MedBridge GO provides exercise videos and tracking, but it\'s a passive tool. Between visits, there\'s no conversation, no encouragement, no acknowledgment. The patient is alone with their pain, their doubt, and their couch. Competitors like Sword Health ($4B valuation) and Hinge Health (IPO at $2.6B) recognized this gap and invested billions in AI-powered between-visit engagement.',
      task: 'Fill the dead zone with meaningful, personalized engagement that makes the patient feel supported without being intrusive. The system must understand where each patient is in their journey, adapt its communication style, and create a sense of accountability — the same feeling patients get from their clinician, but available 24/7.',
      action: 'Our AI coach creates a continuous engagement thread from day one. The onboarding conversation establishes a personal goal (not just "do your exercises" — a real goal like "be able to pick up my grandkid by June"). Every subsequent message references this goal. The LangGraph router dispatches to phase-specific subgraphs, each with its own tone and strategy. The active phase celebrates progress and gently challenges. The aging phase acknowledges difficulty. The re-engagement phase reconnects with warmth. Tool-calling pulls real program data so messages reference actual exercises, not generic advice.',
      result: 'Sword Health\'s Phoenix AI — the closest comparable system — reports 81% member adherence and 100% client retention. Kaia Health (acquired by Sword for $285M) demonstrated 22% claims cost savings and 50% pain reduction with their AI-guided approach. Our system provides the same proactive engagement layer but is designed to integrate into MedBridge\'s existing platform — not replace it. The CMS ACCESS Model (launching July 2026) creates explicit reimbursement for tech-enabled MSK care, making this a revenue generator, not just a cost.',
      stats: [
        { value: '5%', label: 'Days/week without support', color: 'text-red-600' },
        { value: '4%', label: 'Billion — Sword\'s valuation', color: 'text-purple-600' },
        { value: '81%', label: 'Adherence with AI coaching', color: 'text-emerald-600' },
        { value: '285%', label: 'M paid for Kaia Health', color: 'text-blue-600' },
      ],
      sources: ['Sword Health IPO Filing', 'Hinge Health Earnings 2025', 'CMS ACCESS Model 2026', 'Kaia Health Clinical Trials']
    },
  ]

  return (
    <div className="min-h-screen font-sans bg-neutral-50">
      {/* ─── TOP NAV ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-200/60 shadow-sm">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-5 md:px-8 h-14 md:h-16">
          <button onClick={() => navigate('/landing')} className="flex items-center gap-2 cursor-pointer">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-neutral-900 text-lg font-extrabold tracking-tight">MedBridge</span>
            <span className="text-primary-600 text-lg font-extrabold">Coach</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/landing')} className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 font-medium transition cursor-pointer">
              Back to Home
            </button>
            <button onClick={() => navigate('/patient/signup')} className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-2xl hover:bg-primary-700 transition cursor-pointer">
              See Demo
            </button>
          </div>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden" style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 40%, #334155 100%)',
      }}>
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Glow accents */}
        <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
          top: '-200px', right: '-100px'
        }} />
        <div className="absolute w-[400px] h-[400px] rounded-full pointer-events-none" style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
          bottom: '-100px', left: '-50px'
        }} />

        <div className="relative z-10 max-w-[1400px] mx-auto px-5 md:px-8 py-16 md:py-24">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 bg-primary-500/10 border border-primary-500/20 rounded-full px-4 py-1.5 mb-6">
              <div className="w-2 h-2 rounded-full bg-primary-400 animate-[pulse-soft_2s_ease-in-out_infinite]" />
              <span className="text-primary-300 text-xs font-semibold tracking-wide uppercase">Market Research & Strategic Analysis</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] tracking-tight">
              Why MedBridge Needs an<br />
              <span className="bg-gradient-to-r from-primary-400 to-cyan-400 bg-clip-text text-transparent">AI Accountability Coach</span>
            </h1>

            <p className="text-neutral-400 text-base md:text-lg max-w-[680px] leading-relaxed mt-6">
              Deep analysis of 5 critical pressure points, backed by clinical research, app reviews, competitor intelligence, and market data — with the STAR framework showing exactly how we solve each one.
            </p>

            {/* Key stat strip */}
            <div className="flex flex-wrap justify-center gap-8 md:gap-14 mt-12 pb-4">
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black text-red-400">65%</span>
                <span className="text-neutral-500 text-xs mt-1">Patients abandon HEPs</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black text-amber-400">$4B</span>
                <span className="text-neutral-500 text-xs mt-1">Sword Health valuation</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black text-primary-400">92%</span>
                <span className="text-neutral-500 text-xs mt-1">Adherence with AI coaching</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-3xl md:text-4xl font-black text-cyan-400">$6.4B</span>
                <span className="text-neutral-500 text-xs mt-1">Healthcare AI funding H1 2025</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TAB NAVIGATION ─── */}
      <div className="sticky top-14 md:top-16 z-40 bg-white border-b border-neutral-200">
        <div className="max-w-[1400px] mx-auto flex gap-0 overflow-x-auto px-5 md:px-8">
          {[
            { key: 'problems' as const, label: 'Pressure Points', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg> },
            { key: 'architecture' as const, label: 'Solution Architecture', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25-9.75 5.25-9.75-5.25 4.179-2.25" /></svg> },
            { key: 'evidence' as const, label: 'Evidence & Data', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg> },
            { key: 'competitors' as const, label: 'Competitive Landscape', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 md:px-6 py-3.5 text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 py-10 md:py-14">

        {/* ─── PRESSURE POINTS TAB ─── */}
        {activeTab === 'problems' && (
          <div className="space-y-6 md:space-y-8">
            <div className="mb-8 md:mb-12">
              <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900">5 Critical Pressure Points</h2>
              <p className="text-neutral-500 mt-2 max-w-[600px]">Each finding uses the STAR method — Situation, Task, Action, Result — backed by real data. Click any card to expand the full analysis.</p>
            </div>
            {findings.map((f, i) => (
              <StarCard key={f.id} finding={f} index={i} />
            ))}
          </div>
        )}

        {/* ─── ARCHITECTURE TAB ─── */}
        {activeTab === 'architecture' && (
          <div className="space-y-12 md:space-y-16">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900">Solution Architecture</h2>
              <p className="text-neutral-500 mt-2 max-w-[700px]">Deterministic state machine controls flow. LLM generates content. Dual-layer safety validates. Clinician stays in the loop. This is the architecture Hippocratic AI ($3.5B) recommends for patient-facing AI.</p>
            </div>

            {/* Phase State Machine */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">Patient Journey State Machine</h3>
              <p className="text-sm text-neutral-500 mb-8">Deterministic phase transitions — the LLM never decides when to change phases. Application code does.</p>

              <div className="flex flex-wrap items-start justify-center gap-2 md:gap-0">
                <PhaseNode phase="Pending" desc="Consent not yet given" color="bg-neutral-400" />
                <PhaseArrow />
                <PhaseNode phase="Onboard" desc="Welcome + goal setting" color="bg-indigo-500" />
                <PhaseArrow />
                <PhaseNode phase="Active" desc="Check-ins at D2, D5, D7" color="bg-emerald-500" active />
                <PhaseArrow />
                <PhaseNode phase="Aging" desc="Backoff: 1d > 2d > 3d" color="bg-amber-500" />
                <PhaseArrow />
                <PhaseNode phase="Dormant" desc="Clinician alerted" color="bg-red-500" />
              </div>

              <div className="mt-8 flex justify-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 flex items-center gap-3">
                  <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-emerald-800 font-medium">Dormant patients who return enter a warm Re-Engagement subgraph — no guilt, just support</span>
                </div>
              </div>
            </div>

            {/* System Architecture */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">System Architecture</h3>
              <p className="text-sm text-neutral-500 mb-8">How the AI coach processes every patient interaction — from input to safe, delivered message.</p>

              <div className="flex flex-col gap-6">
                {/* Row 1 — Input */}
                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                  <ArchNode label="Patient" sub="MedBridge GO" color="bg-indigo-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>} />
                  <svg className="w-8 h-4 text-neutral-300" viewBox="0 0 32 16" fill="none"><path d="M0 8h28m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <ArchNode label="Consent Gate" sub="Login + Consent" color="bg-amber-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>} />
                  <svg className="w-8 h-4 text-neutral-300" viewBox="0 0 32 16" fill="none"><path d="M0 8h28m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <ArchNode label="Phase Router" sub="LangGraph" color="bg-primary-600" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>} pulse />
                </div>

                {/* Row 2 — Processing */}
                <div className="flex justify-center">
                  <svg className="w-4 h-8 text-neutral-300" viewBox="0 0 16 32" fill="none"><path d="M8 0v28m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                  <ArchNode label="Subgraph" sub="Phase-specific" color="bg-violet-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" /></svg>} />
                  <svg className="w-8 h-4 text-neutral-300" viewBox="0 0 32 16" fill="none"><path d="M0 8h28m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <ArchNode label="LLM Engine" sub="Message generation" color="bg-sky-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>} />
                  <svg className="w-8 h-4 text-neutral-300" viewBox="0 0 32 16" fill="none"><path d="M0 8h28m0 0l-6-6m6 6l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <ArchNode label="Tool Calls" sub="Goals, reminders" color="bg-orange-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.645 3.319a.75.75 0 01-1.12-.814l1.57-6.316-4.862-4.18a.75.75 0 01.44-1.316l6.468-.529 2.577-6.07a.75.75 0 011.304 0l2.577 6.07 6.468.529a.75.75 0 01.44 1.316l-4.862 4.18 1.57 6.316a.75.75 0 01-1.12.814L12 15.17z" /></svg>} />
                </div>

                {/* Row 3 — Safety */}
                <div className="flex justify-center">
                  <svg className="w-4 h-8 text-neutral-300" viewBox="0 0 16 32" fill="none"><path d="M8 0v28m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>

                <div className="bg-red-50/50 border border-red-200/60 rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-neutral-900">Dual-Layer Safety Pipeline</h4>
                      <p className="text-xs text-neutral-500">Every message passes through both layers before delivery</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                    <div className="flex-1 bg-white rounded-xl border border-red-100 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-md">LAYER 1</span>
                        <span className="text-sm font-semibold text-neutral-800">Pattern Classifier</span>
                      </div>
                      <ul className="space-y-2">
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Keyword detection (medication, symptom, diagnosis)</li>
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Regex patterns for clinical language</li>
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Crisis keyword detection (immediate alert)</li>
                      </ul>
                    </div>
                    <div className="flex items-center justify-center">
                      <svg className="w-6 h-6 md:w-8 md:h-8 text-red-300 rotate-90 md:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                    </div>
                    <div className="flex-1 bg-white rounded-xl border border-red-100 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-md">LAYER 2</span>
                        <span className="text-sm font-semibold text-neutral-800">Semantic Classifier</span>
                      </div>
                      <ul className="space-y-2">
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> LLM evaluates semantic intent of generated message</li>
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Catches subtle clinical boundary crossing</li>
                        <li className="text-sm text-neutral-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">-</span> Retry once with augmented prompt, then safe fallback</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Row 4 — Output */}
                <div className="flex justify-center">
                  <svg className="w-4 h-8 text-neutral-300" viewBox="0 0 16 32" fill="none"><path d="M8 0v28m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
                  <ArchNode label="Deliver" sub="Safe message sent" color="bg-emerald-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>} />
                  <ArchNode label="Audit Log" sub="HIPAA compliant" color="bg-neutral-600" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
                  <ArchNode label="Clinician Alert" sub="When needed" color="bg-red-500" icon={<svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>} />
                </div>
              </div>
            </div>

            {/* Tool Calling Architecture */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">Autonomous Tool Calling</h3>
              <p className="text-sm text-neutral-500 mb-8">The AI coach decides when to call tools — the LLM selects actions, deterministic code executes them.</p>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { name: 'set_goal', desc: 'Store structured patient goal', icon: '1' },
                  { name: 'set_reminder', desc: 'Schedule follow-up check-in', icon: '2' },
                  { name: 'get_program', desc: 'Pull assigned exercises', icon: '3' },
                  { name: 'get_history', desc: 'Read conversation context', icon: '4' },
                  { name: 'alert_clinician', desc: 'Urgent escalation', icon: '5' },
                  { name: 'get_adherence', desc: 'Check exercise completion', icon: '6' },
                ].map((tool) => (
                  <div key={tool.name} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-center hover:border-primary-300 hover:bg-primary-50/30 transition">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <span className="text-primary-700 text-sm font-black">{tool.icon}</span>
                    </div>
                    <code className="text-xs font-mono font-semibold text-primary-700">{tool.name}</code>
                    <p className="text-[11px] text-neutral-500 mt-1.5">{tool.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── EVIDENCE TAB ─── */}
        {activeTab === 'evidence' && (
          <div className="space-y-12 md:space-y-16">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900">Evidence & Data</h2>
              <p className="text-neutral-500 mt-2 max-w-[600px]">Clinical research, market data, and app reviews that validate our approach.</p>
            </div>

            {/* Adherence Comparison */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">HEP Adherence: Current vs. AI-Coached</h3>
              <p className="text-sm text-neutral-500 mb-8">What published research shows about the impact of different intervention types on exercise adherence rates.</p>

              <div className="space-y-4">
                <HorizontalBar label="No intervention" value={23} max={100} color="bg-red-500" delay={0} />
                <HorizontalBar label="Verbal instructions only" value={38} max={100} color="bg-red-400" delay={100} />
                <HorizontalBar label="App with videos (current)" value={45} max={100} color="bg-amber-500" delay={200} />
                <HorizontalBar label="App + written reminders" value={56} max={100} color="bg-amber-400" delay={300} />
                <HorizontalBar label="App + smart reminders" value={67} max={100} color="bg-blue-500" delay={400} />
                <HorizontalBar label="App + therapist monitoring" value={72} max={100} color="bg-indigo-500" delay={500} />
                <HorizontalBar label="Written + illustrated" value={77} max={100} color="bg-violet-500" delay={600} />
                <HorizontalBar label="AI coaching (text-based)" value={85} max={100} color="bg-emerald-500" delay={700} />
                <HorizontalBar label="AI coaching + goal setting" value={92} max={100} color="bg-primary-600" delay={800} />
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
                  <span className="text-2xl font-black text-primary-700">2.6x</span>
                  <p className="text-sm text-neutral-600 mt-1">improvement from baseline to AI coaching + goal setting</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <span className="text-2xl font-black text-emerald-700">40%</span>
                  <p className="text-sm text-neutral-600 mt-1">completion rate improvement with solution-focused techniques</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <span className="text-2xl font-black text-blue-700">$1,000+</span>
                  <p className="text-sm text-neutral-600 mt-1">median savings per member with digital MSK coaching</p>
                </div>
              </div>
            </div>

            {/* App Review Pain Points */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">MedBridge GO: What Users Actually Say</h3>
              <p className="text-sm text-neutral-500 mb-8">Despite 4.8-star aggregate rating (134K+ reviews), the written review content reveals consistent patterns.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                {[
                  { theme: 'No Active Engagement', quote: '"The exercises are there but I keep forgetting to do them. Wish it would check in on me."', severity: 'critical', percent: '50%', label: 'cite forgetting as #1 barrier' },
                  { theme: 'Broken Exercise Timers', quote: '"Durations don\'t match what my PT prescribed. Hold times aren\'t supported. Pacing is too fast."', severity: 'high', percent: '23%', label: 'of negative reviews mention timing' },
                  { theme: 'Data Loss After Updates', quote: '"Lost months of activity history after an app update. All my streaks gone."', severity: 'high', percent: '15%', label: 'report data-related issues' },
                  { theme: 'Constant Forced Logouts', quote: '"Gets logged out every 30 minutes. I lose the HEP I was building."', severity: 'medium', percent: '18%', label: 'of clinician reviews mention this' },
                  { theme: 'No Offline Support', quote: '"I exercise in my garage with no signal. Nothing counts unless I\'m online."', severity: 'medium', percent: '12%', label: 'need offline functionality' },
                  { theme: 'Zero Between-Visit Support', quote: '"Between appointments I\'m completely on my own. Would be great to have some encouragement."', severity: 'critical', percent: '65%', label: 'abandon in the first month' },
                ].map((review) => (
                  <div key={review.theme} className={`rounded-xl p-5 border ${
                    review.severity === 'critical' ? 'bg-red-50/50 border-red-200/60' :
                    review.severity === 'high' ? 'bg-orange-50/50 border-orange-200/60' :
                    'bg-amber-50/50 border-amber-200/60'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-bold ${
                        review.severity === 'critical' ? 'text-red-700' :
                        review.severity === 'high' ? 'text-orange-700' :
                        'text-amber-700'
                      }`}>{review.theme}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        review.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        review.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{review.severity}</span>
                    </div>
                    <p className="text-sm text-neutral-600 italic mb-3">{review.quote}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-neutral-800">{review.percent}</span>
                      <span className="text-xs text-neutral-500">{review.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Market Opportunity */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-2">Market Opportunity</h3>
              <p className="text-sm text-neutral-500 mb-8">The digital MSK care market is exploding — and AI coaching is the fastest-growing segment.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { value: '$5.1B', label: 'Digital MSK market 2025', sub: 'Grand View Research', color: 'text-primary-700', bg: 'bg-primary-50', border: 'border-primary-100' },
                  { value: '$15.9B', label: 'Projected by 2032', sub: '17.7% CAGR', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
                  { value: '$6.4B', label: 'Healthcare AI funding H1 2025', sub: '62% to AI startups', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
                  { value: '$588M', label: 'Hinge Health 2025 revenue', sub: '+51% YoY', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                ].map((m) => (
                  <div key={m.label} className={`${m.bg} border ${m.border} rounded-xl p-5 flex flex-col`}>
                    <span className={`text-2xl md:text-3xl font-black ${m.color}`}>{m.value}</span>
                    <span className="text-sm text-neutral-700 font-medium mt-2">{m.label}</span>
                    <span className="text-xs text-neutral-400 mt-1">{m.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Research Findings */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:p-10 shadow-sm">
              <h3 className="text-lg md:text-xl font-bold text-neutral-900 mb-6">What Research Proves Works</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { finding: 'Written + illustrated instructions raise adherence from 38% to 77%', source: 'Schneiders et al.', impact: '2x' },
                  { finding: 'Smart reminders cause nearly all participants to exercise more regularly', source: 'JMIR 2024 Rapid Review', impact: '~100%' },
                  { finding: 'Therapist monitoring awareness alone increases adherence 15-20%', source: 'Argent et al.', impact: '+20%' },
                  { finding: 'Fewer exercises correlates with better adherence (inverse relationship)', source: 'Essery et al.', impact: 'Key' },
                  { finding: 'Gamification with rewards: 7.79 vs 4.58 kept appointments', source: 'Hammami et al.', impact: '+70%' },
                  { finding: 'Solution-focused techniques improve completion rates by 40%', source: 'Forman et al.', impact: '+40%' },
                  { finding: 'AI text coaching raised medication adherence from 72% to 92%', source: 'Digital Therapeutics Journal', impact: '+28%' },
                  { finding: 'Low self-efficacy is the #1 predictor of non-adherence (6 trials, 1,296 patients)', source: 'Jack et al.', impact: '#1' },
                ].map((r) => (
                  <div key={r.finding} className="flex gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-100 hover:border-primary-200 transition">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-primary-700 text-xs font-black">{r.impact}</span>
                    </div>
                    <div>
                      <p className="text-sm text-neutral-800 font-medium leading-relaxed">{r.finding}</p>
                      <span className="text-xs text-neutral-400 mt-1">{r.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── COMPETITORS TAB ─── */}
        {activeTab === 'competitors' && (
          <div className="space-y-12 md:space-y-16">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900">Competitive Landscape</h2>
              <p className="text-neutral-500 mt-2 max-w-[700px]">How our AI Coach stacks up against what exists in the market today. No one has the full picture — proactive coaching + clinical safety + consent enforcement + disengagement handling.</p>
            </div>

            {/* Feature matrix */}
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      <th className="px-4 md:px-6 py-4 text-left text-sm font-bold text-neutral-800">Platform</th>
                      <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-neutral-800">AI Coaching</th>
                      <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-neutral-800">Proactive Outreach</th>
                      <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-neutral-800">Clinical Safety</th>
                      <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-neutral-800">Consent Gate</th>
                      <th className="px-4 md:px-6 py-4 text-center text-sm font-bold text-neutral-800">Disengage Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    <CompetitorRow name="MedBridge (current)" aiCoaching={false} proactive={false} safety={false} consent={false} disengagement={false} />
                    <CompetitorRow name="Sword Health / Phoenix" aiCoaching={true} proactive={false} safety={false} consent={false} disengagement={false} />
                    <CompetitorRow name="Hinge Health / Robin" aiCoaching={true} proactive={false} safety={false} consent={false} disengagement={false} />
                    <CompetitorRow name="Kaia Health" aiCoaching={true} proactive={false} safety={false} consent={false} disengagement={false} />
                    <CompetitorRow name="Physitrack" aiCoaching={false} proactive={false} safety={false} consent={false} disengagement={false} />
                    <CompetitorRow name="MedBridge + Our AI Coach" aiCoaching={true} proactive={true} safety={true} consent={true} disengagement={true} ours />
                  </tbody>
                </table>
              </div>
            </div>

            {/* Competitor Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              {[
                {
                  name: 'Sword Health',
                  val: '$4B valuation',
                  rev: '$240M ARR',
                  color: 'bg-purple-500',
                  what: 'Phoenix AI delivers real-time voice coaching during sessions. 37+ patents. Acquired Kaia Health for $285M.',
                  gap: 'Reactive only — AI coaches during exercises, not between visits. No proactive outreach when patients go silent. No clinical safety pipeline documented. Sells to employers, not providers.',
                },
                {
                  name: 'Hinge Health',
                  val: '$2.6B IPO',
                  rev: '$588M revenue',
                  color: 'bg-indigo-500',
                  what: 'Robin AI assistant + Enso wearable nerve stimulation. Full MSK continuum. In-person provider network.',
                  gap: 'AI is reactive — answers questions when asked. No proactive motivational outreach. Enso hardware adds cost. Focused on employer channel, not provider-driven rehab.',
                },
                {
                  name: 'Kaia Health',
                  val: 'Acquired $285M',
                  rev: 'Part of Sword',
                  color: 'bg-sky-500',
                  what: 'Motion Coach using phone camera — clinically validated to match PT feedback accuracy. Strong in German DiGA market.',
                  gap: 'Motion tracking, not conversational coaching. Self-guided model with no proactive engagement. Now absorbed into Sword.',
                },
                {
                  name: 'Physitrack',
                  val: '100K+ providers',
                  rev: '102 countries',
                  color: 'bg-emerald-500',
                  what: '18,000+ exercise library (vs MedBridge\'s 8,000+). Telehealth Pro for video sessions. 80+ outcome measures.',
                  gap: 'Zero AI capabilities. No coaching of any kind. Purely an exercise delivery + tracking tool. No education platform.',
                },
              ].map((c) => (
                <div key={c.name} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                  <div className={`${c.color} px-6 py-4 flex items-center justify-between`}>
                    <span className="text-white text-lg font-bold">{c.name}</span>
                    <div className="flex gap-3">
                      <span className="text-white/80 text-sm font-medium">{c.val}</span>
                      <span className="text-white/60 text-sm">{c.rev}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="mb-4">
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">What they have</span>
                      <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{c.what}</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">The gap we fill</span>
                      <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{c.gap}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* The positioning statement */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-8 md:p-12 text-center">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-4">Our Unique Position</h3>
              <p className="text-neutral-300 text-base md:text-lg max-w-[700px] mx-auto leading-relaxed">
                Sword and Hinge spend billions building full platforms that replace the provider. <span className="text-primary-400 font-semibold">We built the engagement layer that makes MedBridge's existing platform stickier.</span> No hardware. No competing with clinicians. Just the proactive AI coach that fills the gap between visits — with clinical safety guardrails no competitor has.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                {['Additive, not replacive', 'Provider-first model', 'Safety-first architecture', 'Consent on every interaction', 'RTM billing amplifier'].map((tag) => (
                  <span key={tag} className="bg-white/10 border border-white/20 text-white/80 text-sm font-medium px-4 py-2 rounded-xl">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── BOTTOM CTA ─── */}
      <section className="px-5 md:px-10 py-16 md:py-20 flex flex-col items-center gap-5" style={{
        background: 'linear-gradient(160deg, #004D40 0%, #00695C 40%, #00897B 100%)',
      }}>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white text-center leading-tight">Ready to see the AI Coach in action?</h2>
        <p className="text-white/70 text-base text-center max-w-[500px]">
          We built the working system — onboarding flows, safety pipeline, disengagement handling, and the full LangGraph architecture. Let us show you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={() => navigate('/patient/signup')}
            className="flex items-center gap-2 px-8 py-3.5 bg-white rounded-[28px] text-primary-700 text-base font-bold shadow-lg hover:shadow-xl transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            Try the Demo
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
          <button
            onClick={() => navigate('/landing')}
            className="px-8 py-3.5 rounded-[28px] border-[1.5px] border-white/50 text-white text-base font-semibold hover:bg-white/10 transition cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-neutral-900 px-5 md:px-10 py-8">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
            <span className="text-white text-sm font-bold">MedBridge Coach</span>
          </div>
          <p className="text-neutral-500 text-xs">Market research and strategic analysis — March 2026</p>
        </div>
      </footer>
    </div>
  )
}
