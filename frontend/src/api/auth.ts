import api from './axios'
import type { User, TokenResponse, RegisterRequest, LoginRequest, MessageResponse } from '@/types'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<User>('/auth/register', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }).then((r) => r.data),

  logout: (refresh_token: string) =>
    api.post<MessageResponse>('/auth/logout', { refresh_token }).then((r) => r.data),

  getMe: () =>
    api.get<User>('/auth/me').then((r) => r.data),

  toggleAI: (enabled: boolean) =>
    api.patch<MessageResponse>(`/auth/me/ai?enabled=${enabled}`).then((r) => r.data),

  verifyEmail: (token: string) =>
    api.get<MessageResponse>(`/auth/verify-email?token=${token}`).then((r) => r.data),

  resendVerification: (email: string) =>
    api.post<MessageResponse>('/auth/resend-verification', null, { params: { email } }).then((r) => r.data),
}
