import api from './axios'
import type { Notification, MessageResponse } from '@/types'

export const notificationsApi = {
  list: (unread_only = false) =>
    api.get<Notification[]>(`/notifications?unread_only=${unread_only}`).then((r) => r.data),

  markRead: (id: number) =>
    api.patch<MessageResponse>(`/notifications/${id}/read`).then((r) => r.data),

  sendTest: () =>
    api.post<Notification>('/notifications/send-test').then((r) => r.data),

  // Poll for tasks starting within the next 5 minutes
  checkUpcoming: () =>
    api.get<Notification[]>('/notifications/upcoming-tasks').then((r) => r.data),

  // Delete a single notification
  delete: (id: number) =>
    api.delete<MessageResponse>(`/notifications/${id}`).then((r) => r.data),

  // Delete all notifications
  deleteAll: () =>
    api.delete<MessageResponse>('/notifications').then((r) => r.data),
}
