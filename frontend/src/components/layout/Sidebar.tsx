import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Calendar, BarChart2,
  Bell, Settings, LogOut, Zap
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useEffect } from 'react'

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/tasks', icon: CheckSquare, label: 'Tâches' },
  { path: '/planning', icon: Calendar, label: 'Planning' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/notifications', icon: Bell, label: 'Notifications' },
  { path: '/settings', icon: Settings, label: 'Paramètres' },
]

export function Sidebar() {
  const { user, refreshToken, logout } = useAuthStore()

  const qc = useQueryClient()

  // Poll unread count every 10s — always active regardless of current page
  const { data: unreadNotifs = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.list(true),
    refetchInterval: 10_000,
    staleTime: 0,
  })

  const unreadCount = unreadNotifs.length

  // Global reminder checker — runs every 30s from anywhere in the app
  useEffect(() => {
    async function checkReminders() {
      try {
        const reminders = await notificationsApi.checkUpcoming()
        if (reminders.length > 0) {
          qc.invalidateQueries({ queryKey: ['notifications'] })
          reminders.forEach(r => {
            toast(r.body ?? r.title, {
              icon: '🔔',
              duration: 10_000,
              style: {
                background: '#1E293B',
                color: '#F1F5F9',
                border: '1px solid #6366F1',
                borderRadius: '12px',
              },
            })
            if ('Notification' in window && Notification.permission === 'granted') {
              try { new window.Notification(r.title, { body: r.body }) } catch {}
            }
          })
        }
      } catch {}
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    checkReminders()
    const id = setInterval(checkReminders, 30_000)
    return () => clearInterval(id)
  }, [qc])

  async function handleLogout() {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {}
    logout()
  }

  const initials = user?.username?.[0]?.toUpperCase() ?? '?'

  return (
    <aside className="fixed top-0 left-0 w-[220px] h-screen bg-dark-surface border-r border-dark-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-primary to-brand-violet flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <div className="text-base font-bold gradient-text tracking-tight">DAILFOW</div>
            <div className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
              Daily Flow
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative',
                isActive
                  ? 'bg-brand-primary/10 text-brand-primary'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3/5 bg-brand-primary rounded-r-full" />
                )}
                <Icon size={16} className="flex-shrink-0" />
                <span>{label}</span>
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-2.5 pb-4 flex-shrink-0 border-t border-dark-border pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-dark-card mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-primary to-brand-violet flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{user?.username ?? '—'}</div>
            <div className="text-[11px] text-slate-500 truncate">{user?.email ?? '—'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={14} />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
