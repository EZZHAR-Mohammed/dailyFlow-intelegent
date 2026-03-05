import api from './axios'
import type {
  Availability, AvailabilityCreate,
  EnergyProfile, EnergyProfileCreate,
  PlanResponse, ScheduledSlot,
  AIRecommendation, MessageResponse
} from '@/types'

export interface ManualSlotPayload {
  task_id?: number | null
  start_at: string   // ISO datetime string
  end_at: string
  is_break?: boolean
  ai_generated?: boolean
}

export const planningApi = {
  // Availabilities
  listAvailabilities: () =>
    api.get<Availability[]>('/planning/availabilities').then((r) => r.data),

  createAvailability: (data: AvailabilityCreate) =>
    api.post<Availability>('/planning/availabilities', data).then((r) => r.data),

  deleteAvailability: (id: number) =>
    api.delete<MessageResponse>(`/planning/availabilities/${id}`).then((r) => r.data),

  // Energy
  listEnergy: () =>
    api.get<EnergyProfile[]>('/planning/energy').then((r) => r.data),

  upsertEnergy: (data: EnergyProfileCreate) =>
    api.post<EnergyProfile>('/planning/energy', data).then((r) => r.data),

  // Plan generation (auto, uses all pending tasks)
  generatePlan: (target_date: string) =>
    api.post<PlanResponse>('/planning/generate', { target_date }).then((r) => r.data),

  // AI recommendation — earliest_start prevents overlap with previous task
  aiRecommend: (taskId: number, target_date: string, earliest_start?: string) =>
    api.post<AIRecommendation>(`/planning/ai/recommend/${taskId}`, {
      target_date,
      ...(earliest_start ? { earliest_start } : {}),
    }).then((r) => r.data),

  // Get saved schedule — source: "manual" | "ai" | undefined (all)
  getSchedule: (target_date: string, source?: "manual" | "ai") =>
    api.get<ScheduledSlot[]>(`/planning/schedule/${target_date}${source ? `?source=${source}` : ""}`).then((r) => r.data),

  // Save a plan to DB — source: "manual" | "ai" (never mix the two)
  saveManualPlan: (target_date: string, slots: ManualSlotPayload[], source: "manual" | "ai" = "manual") =>
    api.post<ScheduledSlot[]>('/planning/save', { target_date, slots, source }).then((r) => r.data),
}
