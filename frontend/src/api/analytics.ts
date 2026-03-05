import api from './axios'
import type { DailyScore, WeeklyScore, TrendPoint, BurnoutPrediction } from '@/types'

export const analyticsApi = {
  getDaily: (target_date?: string) => {
    const query = target_date ? `?target_date=${target_date}` : ''
    return api.get<DailyScore>(`/analytics/daily${query}`).then((r) => r.data)
  },

  getWeekly: (week_start?: string) => {
    const query = week_start ? `?week_start=${week_start}` : ''
    return api.get<WeeklyScore>(`/analytics/weekly${query}`).then((r) => r.data)
  },

  getTrends: (days = 30) =>
    api.get<TrendPoint[]>(`/analytics/trends?days=${days}`).then((r) => r.data),

  getBurnoutPrediction: () =>
    api.get<BurnoutPrediction>('/analytics/burnout-prediction').then((r) => r.data),
}
