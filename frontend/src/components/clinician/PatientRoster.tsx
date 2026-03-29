import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PatientSummary, RiskAssessment } from '../../lib/types'
import { adherenceColor } from '../../lib/utils'
import { sendDirectMessage } from '../../lib/api'
import { PhaseBadge } from './PhaseBadge'
import { RiskBadge } from './RiskBadge'

type SortOption = 'risk' | 'adherence' | 'name'

interface PatientRosterProps {
  patients: PatientSummary[]
  riskScores?: Record<number, RiskAssessment>
}

export function PatientRoster({ patients, riskScores = {} }: PatientRosterProps) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('risk')
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState<string | null>(null)
  const [quickMsgPatientId, setQuickMsgPatientId] = useState<number | null>(null)
  const [quickMsgText, setQuickMsgText] = useState('')
  const [sending, setSending] = useState(false)

  // Filter
  let filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  if (phaseFilter) {
    filtered = filtered.filter((p) => p.phase === phaseFilter)
  }
  if (riskFilter) {
    filtered = filtered.filter((p) => {
      const r = riskScores[p.id]
      return r && r.risk_level === riskFilter
    })
  }

  // Sort
  filtered.sort((a, b) => {
    if (sort === 'risk') {
      const ra = riskScores[a.id]?.risk_score ?? 0
      const rb = riskScores[b.id]?.risk_score ?? 0
      return rb - ra
    }
    if (sort === 'adherence') {
      return (a.adherence_pct ?? 100) - (b.adherence_pct ?? 100)
    }
    return a.name.localeCompare(b.name)
  })

  const phases = ['ACTIVE', 'RE_ENGAGING', 'DORMANT']
  const riskLevels = ['HIGH', 'CRITICAL']

  const handleQuickSend = async (patientId: number) => {
    if (!quickMsgText.trim()) return
    setSending(true)
    try {
      await sendDirectMessage(patientId, quickMsgText.trim())
      setQuickMsgText('')
      setQuickMsgPatientId(null)
    } catch (err) {
      console.error('Failed to send message:', err)
    }
    setSending(false)
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        />
      </div>

      {/* Sort + Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="risk">Risk (highest)</option>
          <option value="adherence">Adherence (lowest)</option>
          <option value="name">Name A-Z</option>
        </select>

        {phases.map((ph) => (
          <button
            key={ph}
            onClick={() => setPhaseFilter(phaseFilter === ph ? null : ph)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
              phaseFilter === ph
                ? 'bg-primary-100 text-primary-700 border-primary-300'
                : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {ph.replace('_', ' ')}
          </button>
        ))}

        {riskLevels.map((rl) => (
          <button
            key={rl}
            onClick={() => setRiskFilter(riskFilter === rl ? null : rl)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer border ${
              riskFilter === rl
                ? 'bg-red-100 text-red-700 border-red-300'
                : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {rl}
          </button>
        ))}
      </div>

      {/* Patient list */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id}>
            <div className="card flex items-center gap-4 px-4 py-3.5 hover:shadow-card-hover transition-all duration-200">
              {/* Avatar */}
              <Link to={`/dashboard/patient/${p.id}`} className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                  {p.name.split(' ').map(n => n[0]).join('')}
                </div>
              </Link>

              {/* Info */}
              <Link to={`/dashboard/patient/${p.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-800 truncate">{p.name}</span>
                  <PhaseBadge phase={p.phase} />
                  {riskScores[p.id] && (
                    <RiskBadge
                      level={riskScores[p.id].risk_level}
                      score={riskScores[p.id].risk_score}
                    />
                  )}
                </div>
                {p.goal_summary && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">{p.goal_summary}</p>
                )}
              </Link>

              {/* Adherence */}
              <div className="text-right flex-shrink-0">
                {p.adherence_pct !== null ? (
                  <span className={`text-sm font-bold ${adherenceColor(p.adherence_pct)}`}>
                    {p.adherence_pct}%
                  </span>
                ) : (
                  <span className="text-xs text-neutral-300">--</span>
                )}
              </div>

              {/* Quick message button */}
              <button
                onClick={(e) => {
                  e.preventDefault()
                  setQuickMsgPatientId(quickMsgPatientId === p.id ? null : p.id)
                  setQuickMsgText('')
                }}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition cursor-pointer"
                title="Send quick message"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </button>
            </div>

            {/* Inline quick message input */}
            {quickMsgPatientId === p.id && (
              <div className="mt-1 flex gap-2 px-4 animate-fade-in">
                <input
                  type="text"
                  value={quickMsgText}
                  onChange={(e) => setQuickMsgText(e.target.value)}
                  placeholder={`Message ${p.name.split(' ')[0]}...`}
                  className="flex-1 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !sending) handleQuickSend(p.id)
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleQuickSend(p.id)}
                  disabled={sending || !quickMsgText.trim()}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 cursor-pointer"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-4">No patients match filters</p>
        )}
      </div>
    </div>
  )
}
