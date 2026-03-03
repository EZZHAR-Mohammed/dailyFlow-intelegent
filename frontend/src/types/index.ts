// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  username: string
  role: 'user' | 'admin'
  is_active: boolean
  ai_enabled: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  terms_accepted: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type TaskStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'postponed' | 'cancelled'
export type EnergyRequired = 'low' | 'medium' | 'high'

export interface Task {
  id: number
  user_id: number
  title: string
  description: string | null
  priority: Priority
  status: TaskStatus
  energy_required: EnergyRequired
  estimated_duration_minutes: number
  due_date: string | null
  scheduled_at: string | null
  completed_at: string | null
  postpone_count: number
  tags: string
  created_at: string
}

export interface TaskCreate {
  title: string
  description?: string
  priority: Priority
  energy_required: EnergyRequired
  estimated_duration_minutes: number
  due_date?: string
  tags?: string
}

export interface TaskUpdate extends Partial<TaskCreate> {
  status?: TaskStatus
}

export interface TaskExecution {
  id: number
  task_id: number
  user_id: number
  started_at: string
  ended_at: string | null
  actual_duration_minutes: number | null
  energy_level_during: number | null
  focus_score: number | null
  notes: string | null
}

export interface ExecutionCreate {
  started_at: string
  ended_at?: string
  actual_duration_minutes?: number
  energy_level_during?: number
  focus_score?: number
  notes?: string
}

// ── Planning ──────────────────────────────────────────────────────────────────
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type EnergyPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Availability {
  id: number
  user_id: number
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  is_active: boolean
}

export interface AvailabilityCreate {
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
}

export interface EnergyProfile {
  id: number
  period: EnergyPeriod
  energy_level: number
  updated_at: string
}

export interface EnergyProfileCreate {
  period: EnergyPeriod
  energy_level: number
}

export interface ScheduledSlot {
  task_id: number | null
  task_title: string | null
  start_at: string
  end_at: string
  is_break: boolean
  ai_generated: boolean
}

export interface PlanOverload {
  overloaded: boolean
  total_task_minutes: number
  total_available_minutes: number
  excess_minutes: number
  used_default_availability?: boolean
  note?: string
}

export interface PlanResponse {
  date: string
  slots: ScheduledSlot[]
  overload: PlanOverload
}

export interface AIRecommendation {
  task_id: number
  recommended_slot_start: string
  recommended_slot_end: string
  confidence_score: number
  criteria_used: Record<string, number>
  explanation: string
  model_version: string
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export type BurnoutLabel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DailyScore {
  id: number
  score_date: string
  score_type: string
  total_score: number
  discipline_score: number
  focus_score: number
  energy_alignment_rate: number
  completion_rate: number
  burnout_risk_index: number
  tasks_completed: number
  tasks_postponed: number
  tasks_total: number
  burnout_label: BurnoutLabel
}

export interface WeeklyScore {
  total_score: number
  discipline_score: number
  focus_score: number
  energy_alignment_rate: number
  completion_rate: number
  burnout_risk_index: number
  tasks_completed: number
  tasks_postponed: number
  tasks_total: number
  week_start: string
  week_end: string
  burnout_label: BurnoutLabel
}

export interface TrendPoint {
  date: string
  total_score: number
  discipline_score: number
  burnout_risk_index: number
  completion_rate: number
  burnout_label: BurnoutLabel
}

export interface BurnoutPrediction {
  predicted_burnout_risk: number
  risk_level: BurnoutLabel | 'UNKNOWN'
  trend: 'increasing' | 'decreasing' | 'stable'
  recommendation: string
  based_on_days: number
}

// ── Notifications ─────────────────────────────────────────────────────────────
export type NotificationType = 'reminder' | 'planning' | 'achievement' | 'warning' | 'burnout_alert'

export interface Notification {
  id: number
  notification_type: NotificationType
  title: string
  body: string
  is_read: boolean
  created_at: string
}

// ── GDPR ─────────────────────────────────────────────────────────────────────
export interface GDPRExport {
  user: User
  tasks: Task[]
  executions: TaskExecution[]
  scores: DailyScore[]
  availabilities: Availability[]
  energy_profiles: EnergyProfile[]
  exported_at: string
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export interface MessageResponse {
  message: string
}
