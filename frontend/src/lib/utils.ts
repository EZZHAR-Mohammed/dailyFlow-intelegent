import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Priority, TaskStatus, BurnoutLabel } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function getMondayOfWeek(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return format(monday, 'yyyy-MM-dd')
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    const parsed = parseISO(d)
    if (!isValid(parsed)) return d
    return format(parsed, 'd MMM yyyy', { locale: fr })
  } catch {
    return d
  }
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'd MMM yyyy HH:mm', { locale: fr })
  } catch {
    return d
  }
}

export function fmtTime(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return format(parseISO(d), 'HH:mm')
  } catch {
    return d
  }
}

export function fmtRelative(d: string): string {
  try {
    return formatDistanceToNow(parseISO(d), { addSuffix: true, locale: fr })
  } catch {
    return d
  }
}

export function getDueDateStatus(dueDate: string | null): 'overdue' | 'soon' | 'normal' | null {
  if (!dueDate) return null
  const due = parseISO(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  if (diffMs < 0) return 'overdue'
  if (diffMs < 86_400_000) return 'soon'
  return 'normal'
}

export function slotDuration(start: string, end: string): number {
  try {
    return Math.round((parseISO(end).getTime() - parseISO(start).getTime()) / 60000)
  } catch {
    return 0
  }
}

// ── Priority / Status helpers ──────────────────────────────────────────────────
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Moyenne',
  high: 'Haute',
  critical: 'Critique',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'En attente',
  scheduled: 'Planifiée',
  in_progress: 'En cours',
  done: 'Terminée',
  postponed: 'Reportée',
  cancelled: 'Annulée',
}

export const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
}

export const ENERGY_PERIOD_LABELS = [
  { key: 'morning', label: '🌅 Matin', sub: '6h – 12h' },
  { key: 'afternoon', label: '☀️ Après-midi', sub: '12h – 18h' },
  { key: 'evening', label: '🌆 Soirée', sub: '18h – 22h' },
  { key: 'night', label: '🌙 Nuit', sub: '22h – 6h' },
] as const

// ── Score / risk colors ────────────────────────────────────────────────────────
export function scoreColor(score: number): string {
  if (score >= 70) return '#10B981'
  if (score >= 45) return '#F59E0B'
  return '#EF4444'
}

export function riskColor(risk: number): string {
  if (risk >= 0.75) return '#EF4444'
  if (risk >= 0.45) return '#F59E0B'
  return '#10B981'
}

export function burnoutBadgeClass(label: BurnoutLabel | 'UNKNOWN'): string {
  if (label === 'HIGH') return 'badge-danger'
  if (label === 'MEDIUM') return 'badge-warning'
  return 'badge-success'
}

// ── Task score (composite priority) ───────────────────────────────────────────
export function computeTaskScore(task: {
  priority: Priority
  due_date: string | null
  postpone_count: number
}): number {
  const weights: Record<Priority, number> = { low: 1, medium: 2, high: 3.5, critical: 5 }
  const pw = weights[task.priority] ?? 1
  let urgency = 1
  if (task.due_date) {
    const days = Math.max(0, (parseISO(task.due_date).getTime() - Date.now()) / 86_400_000)
    urgency = days < 1 ? 2 : days < 3 ? 1.8 : days < 7 ? 1.4 : 1.1
  }
  const penalty = Math.max(0.1, 1 - task.postpone_count * 0.15)
  return pw * urgency * penalty
}

// ── Extract API error message ─────────────────────────────────────────────────
export function getApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { data?: { detail?: string | object } } }
    const detail = e.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(', ')
  }
  if (err instanceof Error) return err.message
  return 'Une erreur est survenue'
}
