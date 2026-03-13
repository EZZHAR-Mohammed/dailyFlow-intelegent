/**
 * useTaskReminder
 *
 * Polls GET /notifications/upcoming-tasks every 60 seconds.
 * For each task starting within 5 minutes:
 *  1. Creates a notification in DB (backend)
 *  2. Shows a browser Notification (if permission granted)
 *  3. Shows a toast in the UI
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const POLL_INTERVAL_MS = 60_000 // 1 minute

export function useTaskReminder() {
  const { isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Request browser notification permission once
  useEffect(() => {
    if (!isAuthenticated) return
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return

    async function poll() {
      try {
        const reminders = await notificationsApi.checkUpcoming()
        if (!reminders.length) return

        // Invalidate notifications list so badge updates
        qc.invalidateQueries({ queryKey: ['notifications'] })

        for (const notif of reminders) {
          // Toast in app
          toast(notif.body, {
            icon: '🔔',
            duration: 8000,
            style: {
              background: '#1E293B',
              color: '#F1F5F9',
              border: '1px solid #6366F1',
              borderRadius: '12px',
              fontSize: '13px',
            },
          })

          // Native browser notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(notif.title, {
                body: notif.body,
                icon: '/favicon.ico',
                tag: `task-reminder-${notif.id}`,
              })
            } catch {}
          }
        }
      } catch {
        // Silently ignore polling errors (token expired, network, etc.)
      }
    }

    // Poll immediately on mount, then every minute
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isAuthenticated, qc])
}
