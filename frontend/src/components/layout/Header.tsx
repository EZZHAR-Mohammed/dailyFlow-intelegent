import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tasks': 'Mes Tâches',
  '/planning': 'Planning',
  '/analytics': 'Analytics',
  '/notifications': 'Notifications',
  '/settings': 'Paramètres',
}

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const title = PAGE_TITLES[location.pathname] || 'DAILFOW'

  const { data: unread = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationsApi.list(true),
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  const todayLabel = format(new Date(), "EEEE d MMM", { locale: fr })

  return (
    <header className="fixed top-0 left-[220px] right-0 h-14 glass border-b border-dark-border flex items-center justify-between px-6 z-40">
      <div className="text-base font-semibold text-slate-100">{title}</div>

      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-500 font-mono hidden sm:block capitalize px-3 py-1.5 bg-dark-card border border-dark-border rounded-full">
          {todayLabel}
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg bg-dark-card border border-dark-border text-slate-400 hover:text-brand-primary hover:border-brand-primary/50 transition-all"
        >
          <Bell size={16} />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-dark-surface" />
          )}
        </button>
      </div>
    </header>
  )
}
