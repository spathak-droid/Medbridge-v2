export interface ChatMessageMetadata {
  goal_proposed?: boolean
  goal_text?: string
  goal_id?: number
  card_type?: 'goal' | 'program' | 'adherence' | 'safety'
  safety_classification?: 'SAFE' | 'CLINICAL_CONTENT' | 'CRISIS'
}

export interface ChatMessage {
  id: number
  role: 'PATIENT' | 'COACH'
  content: string
  created_at: string
  metadata?: ChatMessageMetadata
}

export interface Conversation {
  id: number
  patient_id: number
  phase_at_creation: string
  started_at: string
  messages: ChatMessage[]
}

export interface SendMessageRequest {
  patient_id: number
  content: string
  conversation_id?: number
}

export interface SendMessageResponse {
  conversation_id: number
  patient_message: ChatMessage
  coach_message: ChatMessage
}

export interface StartOnboardingResponse {
  conversation_id: number
  coach_message: ChatMessage
}

export interface GoalDetails {
  activity?: string
  duration?: number
  duration_unit?: string
  frequency?: number
  frequency_unit?: string
  instructions?: string
  precautions?: string
  video_url?: string
  video_title?: string
}

export interface Goal {
  id: number
  patient_id: number
  raw_text: string
  structured_goal?: GoalDetails | null
  confirmed: boolean
  clinician_approved: boolean
  clinician_rejected: boolean
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
}

export interface AvailableProgram {
  program_type: string
  program_name: string
  duration_weeks: number
  exercise_count: number
}

export interface ConsentStatus {
  consent_given: boolean
}

export interface ConsentResponse {
  id: number
  consent_given: boolean
  consented_at: string | null
}

export interface AlertItem {
  id: number
  patient_id: number
  patient_name: string
  reason: string
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL'
  status: 'NEW' | 'ACKNOWLEDGED'
  created_at: string
  acknowledged_at: string | null
}

// Risk assessment
export interface RiskAssessment {
  patient_id: number
  risk_level: string
  risk_score: number
  risk_factors: string[]
  assessed_at: string
}

// Patient types
export interface PatientSummary {
  id: number
  name: string
  external_id: string
  phase: string
  consent_given: boolean
  adherence_pct: number | null
  goal_summary: string | null
}

export interface Exercise {
  id: string
  name: string
  description: string
  sets: number
  reps: number
  hold_time_seconds: number
  frequency: string
  muscle_groups: string[]
  difficulty: string
  video_id?: string
  video_url?: string
  video_title?: string
  tips?: string
  precautions?: string
}

export interface ProgramSummary {
  program_name: string
  program_type: string
  duration_weeks: number
  start_date: string
  exercises: Exercise[]
}

export interface AdherenceSummary {
  status: string
  total_days_in_program: number
  days_completed: number
  days_missed: number
  current_streak: number
  longest_streak: number
  adherence_percentage: number
  last_completed: string | null
  weekly_breakdown: { week: number; completed: number; total: number }[]
  per_exercise: Record<string, { completed: number; video_watched?: number; total: number; pct: number }>
  daily_log: { date: string; completed: boolean; exercises_done: number; videos_watched?: number }[]
}

export interface VideoProgress {
  [exerciseId: string]: {
    watch_percentage: number
    is_watched: boolean
  }
}

export interface VideoEngagementExercise {
  exercise_id: string
  exercise_name: string
  total_watches: number
  avg_watch_percentage: number
  last_watched: string | null
  days_watched: number
}

export interface VideoEngagement {
  exercises: VideoEngagementExercise[]
  overall_video_adherence: number
}

export interface ScheduleEventItem {
  id: number
  event_type: string
  scheduled_at: string
  executed_at: string | null
  message: string | null
  status: string
}

export interface ActivityFeedItem {
  id: number
  patient_id: number
  patient_name: string
  event_type: string
  description: string
  timestamp: string
}

export interface DirectMessage {
  id: number
  sender_role: 'clinician' | 'patient'
  content: string
  is_broadcast: boolean
  read_at: string | null
  created_at: string
}

export interface PatientInsight {
  summary: string
  generated_at: string
  is_stale: boolean
}

export interface AnalyticsSummary {
  total_patients: number
  phase_distribution: Record<string, number>
  avg_adherence: number
  active_alerts: number
  activity_feed: ActivityFeedItem[]
}

// V2 Analytics types
export interface AttentionPatient {
  patient_id: number
  name: string
  risk_level: string
  risk_score: number
  top_risk_factor: string
  adherence_pct: number | null
  adherence_trend: 'improving' | 'declining' | 'stable'
}

export interface HeatmapCell {
  date: string
  completed: boolean
}

export interface HeatmapRow {
  patient_id: number
  name: string
  cells: HeatmapCell[]
}

export interface DailyRate {
  date: string
  rate: number
}

export interface ProgramStat {
  program_type: string
  program_name: string
  avg_adherence: number
  patient_count: number
}

export interface ProgramOutlier {
  patient_id: number
  name: string
  program_type: string
  adherence_pct: number
  program_avg: number
}

export interface SilentPatient {
  patient_id: number
  name: string
  days_silent: number
  last_message_at: string | null
}

export interface UnansweredPatient {
  patient_id: number
  name: string
  unanswered_count: number
}

export interface MilestoneEvent {
  event_type: 'goal_confirmed' | 'phase_change' | 'alert_generated' | 'streak_milestone' | 'adherence_milestone'
  patient_id: number
  patient_name: string
  description: string
  timestamp: string
}

export interface ClinicalNote {
  id: number
  patient_id: number
  clinician_uid: string
  content: string
  created_at: string
  updated_at: string
}

export interface DailyCheckin {
  id: number
  patient_id: number
  date: string
  pain_level: number
  mood_level: number
  notes: string | null
  created_at: string
}

export interface CoachModeOption {
  id: string
  name: string
  voice: string
  description: string
}

export interface CoachModeResponse {
  current: string
  options: CoachModeOption[]
}

export interface AnalyticsV2Response {
  attention: AttentionPatient[]
  heatmap: HeatmapRow[]
  heatmap_dates: string[]
  daily_rates: DailyRate[]
  programs: ProgramStat[]
  outliers: ProgramOutlier[]
  silent_patients: SilentPatient[]
  unanswered_patients: UnansweredPatient[]
  milestones: MilestoneEvent[]
}
