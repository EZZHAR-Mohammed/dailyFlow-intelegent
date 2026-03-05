import api from './axios'
import type { GDPRExport, MessageResponse } from '@/types'

export const gdprApi = {
  export: () =>
    api.get<GDPRExport>('/gdpr/export').then((r) => r.data),

  deleteAccount: () =>
    api.delete<MessageResponse>('/gdpr/delete-account').then((r) => r.data),
}
