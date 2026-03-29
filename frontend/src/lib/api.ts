import { auth } from './firebase'
import type {
  AdherenceSummary,
  AlertItem,
  AnalyticsSummary,
  AnalyticsV2Response,
  AvailableProgram,
  ChatMessage,
  ClinicalNote,
  ConsentResponse,
  ConsentStatus,
  Conversation,
  DirectMessage,
  Goal,
  PatientInsight,
  PatientSummary,
  ProgramSummary,
  RiskAssessment,
  ScheduleEventItem,
  SendMessageRequest,
  SendMessageResponse,
  StartOnboardingResponse,
  VideoEngagement,
} from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * Get auth headers for the current user.
 * - Real Firebase user: sends Authorization: Bearer <id-token>
 * - Demo user: sends X-Demo-User: <uid>:<role>
 * - Not signed in: empty headers
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  // Check for real Firebase user first
  const fbUser = auth.currentUser
  if (fbUser) {
    const token = await fbUser.getIdToken()
    return { Authorization: `Bearer ${token}` }
  }

  // Check for demo user in localStorage
  const demoRole = localStorage.getItem('carearc_demo_role')
  const demoUid = localStorage.getItem('carearc_demo_uid')
  if (demoRole && demoUid) {
    return { 'X-Demo-User': `${demoUid}:${demoRole}` }
  }

  return {}
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
    ...authHeaders,
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  })
  if (res.status === 401) {
    throw new Error('Authentication required — please sign in again')
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// Risk scores
export function getRiskScores(): Promise<RiskAssessment[]> {
  return apiFetch<RiskAssessment[]>('/api/patients/risk-scores')
}

export function getPatientRisk(patientId: number): Promise<RiskAssessment> {
  return apiFetch<RiskAssessment>(`/api/patients/${patientId}/risk`)
}

// Patient list
export function getPatients(realOnly = false, excludeUid?: string): Promise<PatientSummary[]> {
  const params = new URLSearchParams()
  if (realOnly) params.set('real_only', 'true')
  if (excludeUid) params.set('exclude_uid', excludeUid)
  const qs = params.toString()
  return apiFetch<PatientSummary[]>(`/api/patients${qs ? `?${qs}` : ''}`)
}

// Find or create patient by Firebase UID (for real authenticated users)
export function findOrCreatePatient(firebaseUid: string, name: string): Promise<PatientSummary> {
  return apiFetch<PatientSummary>('/api/patients/me', {
    method: 'POST',
    body: JSON.stringify({ firebase_uid: firebaseUid, name }),
  })
}

// Direct messaging
export function getDirectMessages(patientId: number): Promise<DirectMessage[]> {
  return apiFetch<DirectMessage[]>(`/api/messages/patient/${patientId}`)
}

export function sendDirectMessage(patientId: number, content: string): Promise<DirectMessage> {
  return apiFetch<DirectMessage>('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId, content }),
  })
}

export function sendPatientReply(patientId: number, content: string): Promise<DirectMessage> {
  return apiFetch<DirectMessage>('/api/messages/patient-reply', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId, content }),
  })
}

export function broadcastMessage(content: string): Promise<{ sent_count: number }> {
  return apiFetch<{ sent_count: number }>('/api/messages/broadcast', {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function markMessageRead(messageId: number): Promise<void> {
  return apiFetch('/api/messages/' + messageId + '/read', { method: 'PATCH' })
}

export function getUnreadCount(patientId: number): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(`/api/messages/patient/${patientId}/unread-count`)
}

// Patient insights
export function getPatientInsights(patientId: number): Promise<PatientInsight> {
  return apiFetch<PatientInsight>(`/api/patients/${patientId}/insights`)
}

export function refreshPatientInsights(patientId: number): Promise<PatientInsight> {
  return apiFetch<PatientInsight>(`/api/patients/${patientId}/insights/refresh`, { method: 'POST' })
}

// Exercise logging
export function getExercisesToday(patientId: number, date?: string): Promise<{ completed_exercise_ids: string[] }> {
  const params = date ? `?target_date=${date}` : ''
  return apiFetch<{ completed_exercise_ids: string[] }>(`/api/patients/${patientId}/exercises/today${params}`)
}

export function logExercise(patientId: number, exerciseId: string, completedDate: string): Promise<{ logged: boolean }> {
  return apiFetch<{ logged: boolean }>(`/api/patients/${patientId}/exercises/log`, {
    method: 'POST',
    body: JSON.stringify({ exercise_id: exerciseId, completed_date: completedDate }),
  })
}

export function unlogExercise(patientId: number, exerciseId: string, completedDate: string): Promise<{ logged: boolean }> {
  return apiFetch<{ logged: boolean }>(`/api/patients/${patientId}/exercises/log`, {
    method: 'DELETE',
    body: JSON.stringify({ exercise_id: exerciseId, completed_date: completedDate }),
  })
}

// Exercise ratings
export function rateExercises(patientId: number, exerciseFingerprint: string, rating: number): Promise<{ saved: boolean; already_rated: boolean }> {
  return apiFetch<{ saved: boolean; already_rated: boolean }>(`/api/patients/${patientId}/exercises/rate`, {
    method: 'POST',
    body: JSON.stringify({ exercise_fingerprint: exerciseFingerprint, rating }),
  })
}

export function getRatedExercises(patientId: number): Promise<string[]> {
  return apiFetch<string[]>(`/api/patients/${patientId}/exercises/rated`)
}

// Patient program
export function getProgram(patientId: number): Promise<ProgramSummary | null> {
  return apiFetch<ProgramSummary | null>(`/api/patients/${patientId}/program`)
}

export function getAvailablePrograms(): Promise<AvailableProgram[]> {
  return apiFetch<AvailableProgram[]>('/api/patients/programs/available')
}

export function getProgramsLibrary(): Promise<ProgramSummary[]> {
  return apiFetch<ProgramSummary[]>('/api/patients/programs/library')
}

export function assignProgram(patientId: number, programType: string): Promise<ProgramSummary> {
  return apiFetch<ProgramSummary>(`/api/patients/${patientId}/program`, {
    method: 'POST',
    body: JSON.stringify({ program_type: programType }),
  })
}

export function clearProgram(patientId: number): Promise<{ cleared: boolean }> {
  return apiFetch<{ cleared: boolean }>(`/api/patients/${patientId}/program`, {
    method: 'DELETE',
  })
}

// Patient adherence
export function getAdherence(patientId: number): Promise<AdherenceSummary | null> {
  return apiFetch<AdherenceSummary | null>(`/api/patients/${patientId}/adherence`)
}

// Video progress
export function logVideoProgress(
  patientId: number,
  exerciseId: string,
  watchPercentage: number,
  watchedDate: string
): Promise<{ saved: boolean; exercise_id: string; watch_percentage: number; is_watched: boolean }> {
  return apiFetch(`/api/patients/${patientId}/exercises/video-progress`, {
    method: 'POST',
    body: JSON.stringify({
      exercise_id: exerciseId,
      watch_percentage: watchPercentage,
      watched_date: watchedDate,
    }),
  })
}

export function getVideoProgress(
  patientId: number,
  date?: string
): Promise<{ video_progress: Record<string, { watch_percentage: number; is_watched: boolean }> }> {
  const params = date ? `?target_date=${date}` : ''
  return apiFetch(`/api/patients/${patientId}/exercises/video-progress${params}`)
}

export function getVideoEngagement(patientId: number): Promise<VideoEngagement> {
  return apiFetch<VideoEngagement>(`/api/patients/${patientId}/video-engagement`)
}

// Patient schedule
export function getSchedule(patientId: number): Promise<ScheduleEventItem[]> {
  return apiFetch<ScheduleEventItem[]>(`/api/patients/${patientId}/schedule`)
}

export function createReminder(patientId: number, message: string, scheduledAt: string): Promise<ScheduleEventItem> {
  return apiFetch<ScheduleEventItem>(`/api/patients/${patientId}/reminders`, {
    method: 'POST',
    body: JSON.stringify({ message, scheduled_at: scheduledAt }),
  })
}

// Analytics
export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>('/api/analytics/summary')
}

export function getAnalyticsV2(): Promise<AnalyticsV2Response> {
  return apiFetch<AnalyticsV2Response>('/api/analytics/v2')
}

// Existing endpoints
export function getConversations(patientId: number): Promise<Conversation[]> {
  return apiFetch<Conversation[]>(`/api/patients/${patientId}/conversations`)
}

export function sendMessage(req: SendMessageRequest): Promise<SendMessageResponse> {
  return apiFetch<SendMessageResponse>('/api/coach/message', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function sendMessageStream(
  req: SendMessageRequest,
  onToken: (token: string) => void,
  onDone: (msg: ChatMessage) => void,
  onSafetyOverride?: (msg: ChatMessage) => void,
  onError?: (err: Error) => void,
): Promise<AbortController> {
  const controller = new AbortController()
  const authHeaders = await getAuthHeaders()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
  }

  fetch(`${BASE_URL}/api/coach/message/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (eventType === 'token') onToken(data.content)
              else if (eventType === 'done') onDone(data as ChatMessage)
              else if (eventType === 'safety_override') onSafetyOverride?.(data as ChatMessage)
              else if (eventType === 'error') onError?.(new Error(data.detail || 'Stream error'))
            } catch {
              // skip malformed SSE data lines
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') onError?.(err)
    })

  return controller
}

export function createNewConversation(patientId: number): Promise<{ conversation_id: number; started_at: string }> {
  return apiFetch<{ conversation_id: number; started_at: string }>('/api/coach/new-conversation', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId }),
  })
}

export function startOnboarding(patientId: number): Promise<StartOnboardingResponse> {
  return apiFetch<StartOnboardingResponse>('/api/coach/start-onboarding', {
    method: 'POST',
    body: JSON.stringify({ patient_id: patientId }),
  })
}

export function getGoals(patientId: number): Promise<Goal[]> {
  return apiFetch<Goal[]>(`/api/patients/${patientId}/goals`)
}

export function confirmGoal(goalId: number): Promise<Goal> {
  return apiFetch<Goal>(`/api/goals/${goalId}/confirm`, {
    method: 'POST',
  })
}

export function approveGoal(goalId: number): Promise<Goal> {
  return apiFetch<Goal>(`/api/goals/${goalId}/approve`, {
    method: 'POST',
  })
}

export function rejectGoal(goalId: number, reason: string): Promise<Goal> {
  return apiFetch<Goal>(`/api/goals/${goalId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export function createPatient(name: string, email: string, programType: string): Promise<{ id: number; name: string; email: string; program_type: string; phase: string; consent_given: boolean }> {
  return apiFetch(`/api/patients/create`, {
    method: 'POST',
    body: JSON.stringify({ name, email, program_type: programType }),
  })
}

export function getConsentStatus(patientId: number): Promise<ConsentStatus> {
  return apiFetch<ConsentStatus>(`/api/patients/${patientId}/consent`)
}

export function updateConsent(patientId: number, consentGiven: boolean): Promise<ConsentResponse> {
  return apiFetch<ConsentResponse>(`/api/patients/${patientId}/consent`, {
    method: 'PATCH',
    body: JSON.stringify({ consent_given: consentGiven }),
  })
}

// Auth — register role in backend DB (Firebase custom claims not available)
export function registerRole(role: 'patient' | 'clinician'): Promise<{ uid: string; role: string }> {
  return apiFetch<{ uid: string; role: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ role }),
  })
}

// Clinical notes
export function getPatientNotes(patientId: number): Promise<ClinicalNote[]> {
  return apiFetch<ClinicalNote[]>(`/api/patients/${patientId}/notes`)
}

export function createPatientNote(patientId: number, content: string): Promise<ClinicalNote> {
  return apiFetch<ClinicalNote>(`/api/patients/${patientId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
}

export function deletePatientNote(patientId: number, noteId: number): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/patients/${patientId}/notes/${noteId}`, {
    method: 'DELETE',
  })
}

export function getAlerts(): Promise<AlertItem[]> {
  return apiFetch<AlertItem[]>('/api/alerts')
}

export function acknowledgeAlert(alertId: number): Promise<AlertItem> {
  return apiFetch<AlertItem>(`/api/alerts/${alertId}/acknowledge`, {
    method: 'PATCH',
  })
}
