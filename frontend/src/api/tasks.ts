import api from './axios'
import type {
  Task, TaskCreate, TaskUpdate, TaskExecution,
  ExecutionCreate, MessageResponse, Priority, TaskStatus
} from '@/types'

export interface TaskFilters {
  status?: TaskStatus | ''
  priority?: Priority | ''
}

export const tasksApi = {
  list: (filters?: TaskFilters) => {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.priority) params.append('priority', filters.priority)
    const query = params.toString()
    return api.get<Task[]>(`/tasks${query ? '?' + query : ''}`).then((r) => r.data)
  },

  create: (data: TaskCreate) =>
    api.post<Task>('/tasks', data).then((r) => r.data),

  getById: (id: number) =>
    api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  update: (id: number, data: TaskUpdate) =>
    api.patch<Task>(`/tasks/${id}`, data).then((r) => r.data),

  delete: (id: number) =>
    api.delete<MessageResponse>(`/tasks/${id}`).then((r) => r.data),

  markDone: (id: number) =>
    api.post<Task>(`/tasks/${id}/done`).then((r) => r.data),

  postpone: (id: number) =>
    api.post<Task>(`/tasks/${id}/postpone`).then((r) => r.data),

  createExecution: (taskId: number, data: ExecutionCreate) =>
    api.post<TaskExecution>(`/tasks/${taskId}/executions`, data).then((r) => r.data),

  listExecutions: (taskId: number) =>
    api.get<TaskExecution[]>(`/tasks/${taskId}/executions`).then((r) => r.data),
}
