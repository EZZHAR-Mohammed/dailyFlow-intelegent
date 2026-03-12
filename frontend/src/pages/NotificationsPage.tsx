import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, LoadingPage } from '@/components/ui/EmptyState'
import { fmtRelative, getApiError } from '@/lib/utils'
import type { NotificationType } from '@/types'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

const NOTIF_ICONS: Record<NotificationType, string> = {
  reminder:     '🔔',
  planning:     '📅',
  achievement:  '🏆',
  warning:      '⚠️',
  burnout_alert:'🔥',
}

const NOTIF_LABELS: Record<NotificationType, string> = {
  reminder:     'Rappel',
  planning:     'Planning',
  achievement:  'Succès',
  warning:      'Avertissement',
  burnout_alert:'Alerte burnout',
}

export default function NotificationsPage() {
  const qc = useQueryClient()

  const { data: notifs = [], isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => notificationsApi.list(false),
    staleTime: 0,
    refetchInterval: 10_000,  // refresh list every 10s
  })

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification supprimée')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteAllMutation = useMutation({
    mutationFn: notificationsApi.deleteAll,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Toutes les notifications supprimées')
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const unread = notifs.filter(n => !n.is_read)

  async function markAllRead() {
    await Promise.all(unread.map(n => notificationsApi.markRead(n.id)))
    qc.invalidateQueries({ queryKey: ['notifications'] })
    toast.success('Toutes les notifications lues')
  }

  // Group by date
  const grouped: Record<string, typeof notifs> = {}
  notifs.forEach(n => {
    const d = new Date(n.created_at).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(n)
  })

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-slate-400 mt-1">
            {unread.length > 0
              ? <><span className="font-mono text-brand-primary">{unread.length}</span> non lue{unread.length > 1 ? 's' : ''}</>
              : 'Tout est lu ✓'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread.length > 0 && (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              ✓ Tout lire
            </Button>
          )}
          {notifs.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              loading={deleteAllMutation.isPending}
              onClick={() => deleteAllMutation.mutate()}
            >
              <Trash2 size={13} /> Tout supprimer
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingPage />
      ) : notifs.length === 0 ? (
        <Card>
          <EmptyState
            icon="🔔"
            title="Aucune notification"
            description="Les rappels apparaissent automatiquement quand l'heure de début d'une tâche approche."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-1">
                {date}
              </div>
              <Card className="p-0 overflow-hidden">
                {items.map(n => (
                  <div
                    key={n.id}
                    className={[
                      'flex gap-3 px-4 py-4 border-b border-dark-border last:border-0 transition-all',
                      !n.is_read ? 'bg-brand-primary/[0.04]' : 'opacity-70',
                    ].join(' ')}
                  >
                    {/* Unread dot */}
                    <div className="pt-2 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full mt-0.5 ${!n.is_read ? 'bg-brand-primary' : 'bg-transparent'}`} />
                    </div>

                    {/* Icon */}
                    <div className="text-xl flex-shrink-0 pt-0.5">
                      {NOTIF_ICONS[n.notification_type] ?? '🔔'}
                    </div>

                    {/* Content — click to mark read */}
                    <div
                      className={`flex-1 min-w-0 ${!n.is_read ? 'cursor-pointer' : ''}`}
                      onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
                    >
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-sm font-semibold ${!n.is_read ? 'text-slate-100' : 'text-slate-400'}`}>
                          {n.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-dark-surface text-slate-500 uppercase font-mono">
                          {NOTIF_LABELS[n.notification_type]}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">{n.body}</div>
                      <div className="text-xs text-slate-600 mt-1">{fmtRelative(n.created_at)}</div>
                    </div>

                    {/* Delete button — always visible */}
                    <button
                      onClick={() => deleteMutation.mutate(n.id)}
                      className="flex-shrink-0 self-start mt-1 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Supprimer cette notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
