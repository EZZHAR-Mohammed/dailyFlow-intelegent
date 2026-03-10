import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, TrendingUp, TrendingDown, Minus, Calendar, ArrowRight } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'
import { tasksApi } from '@/api/tasks'
import { planningApi } from '@/api/planning'
import { useAuthStore } from '@/store/authStore'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Select } from '@/components/ui/Input'
import { Input } from '@/components/ui/Input'
import { ScoreRing, ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState, LoadingPage } from '@/components/ui/EmptyState'
import {
  today, fmtTime, scoreColor, riskColor, computeTaskScore,
  PRIORITY_LABELS, getApiError
} from '@/lib/utils'
import type { Priority, EnergyRequired } from '@/types'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickPriority, setQuickPriority] = useState<Priority>('medium')
  const [quickEnergy, setQuickEnergy] = useState<EnergyRequired>('medium')
  const [quickDuration, setQuickDuration] = useState(30)

  const t = today()

  const { data: dailyScore, isLoading: loadingScore } = useQuery({
    queryKey: ['analytics', 'daily', t],
    queryFn: () => analyticsApi.getDaily(t),
    staleTime: 60_000,
  })

  const { data: burnout } = useQuery({
    queryKey: ['analytics', 'burnout'],
    queryFn: analyticsApi.getBurnoutPrediction,
    staleTime: 120_000,
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksApi.list(),
    staleTime: 30_000,
  })

  const { data: schedule = [] } = useQuery({
    queryKey: ['schedule', t],
    queryFn: () => planningApi.getSchedule(t),
    staleTime: 60_000,
  })

  const quickAddMutation = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: quickTitle,
        priority: quickPriority,
        energy_required: quickEnergy,
        estimated_duration_minutes: quickDuration,
      }),
    onSuccess: () => {
      toast.success('Tâche ajoutée ✅')
      setQuickTitle('')
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const pendingTasks = tasks.filter((t) => t.status === 'pending')

  const topTasks = pendingTasks
    .map((t) => ({ ...t, score: computeTaskScore(t) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const greetingHour = new Date().getHours()
  const greeting =
    greetingHour < 12 ? 'Bonjour' : greetingHour < 18 ? 'Bonne après-midi' : 'Bonsoir'

  const dateLabel = format(new Date(), "EEEE d MMMM yyyy", { locale: fr })

  const trendIcons: Record<string, React.ReactNode> = {
    increasing: <TrendingUp size={14} className="text-red-400" />,
    decreasing: <TrendingDown size={14} className="text-emerald-400" />,
    stable: <Minus size={14} className="text-amber-400" />,
  }

  if (loadingScore) return <LoadingPage />

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}, <span className="gradient-text">{user?.username}</span> 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1 capitalize">{dateLabel}</p>
        </div>
        <Button variant="primary" onClick={() => setTaskModalOpen(true)}>
          <Plus size={14} /> Nouvelle tâche
        </Button>
      </div>

      {/* Row 1: Score ring + 3 counters */}
      <div className="grid grid-cols-4 gap-4">
        {/* Score ring */}
        <Card className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-between w-full">
            <CardTitle>Score du jour</CardTitle>
            {dailyScore && (
              <Badge variant={dailyScore.burnout_label}>{dailyScore.burnout_label}</Badge>
            )}
          </div>
          <div className="relative">
            <ScoreRing
              value={dailyScore?.total_score ?? 0}
              color={scoreColor(dailyScore?.total_score ?? 0)}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono" style={{ color: scoreColor(dailyScore?.total_score ?? 0) }}>
                {Math.round(dailyScore?.total_score ?? 0)}
              </span>
              <span className="text-xs text-slate-500">/100</span>
            </div>
          </div>
        </Card>

        {/* Completed */}
        <Card>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">✅ Complétées</div>
          <div className="text-4xl font-bold font-mono text-emerald-400">
            {dailyScore?.tasks_completed ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">tâches aujourd'hui</div>
        </Card>

        {/* Pending */}
        <Card>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">⏳ En attente</div>
          <div className="text-4xl font-bold font-mono text-brand-primary">
            {pendingTasks.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">tâches pending</div>
        </Card>

        {/* Postponed */}
        <Card>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">⏭ Reportées</div>
          <div className="text-4xl font-bold font-mono text-amber-400">
            {dailyScore?.tasks_postponed ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">aujourd'hui</div>
        </Card>
      </div>

      {/* Row 2: Burnout + Schedule */}
      <div className="grid grid-cols-2 gap-4">
        {/* Burnout */}
        <Card>
          <CardHeader>
            <CardTitle>🔥 Risque Burnout</CardTitle>
            {burnout && burnout.risk_level !== 'UNKNOWN' && (
              <div className="flex items-center gap-1.5">
                {trendIcons[burnout.trend ?? 'stable']}
                <Badge variant={burnout.risk_level as 'LOW' | 'MEDIUM' | 'HIGH'}>
                  {burnout.risk_level}
                </Badge>
              </div>
            )}
          </CardHeader>

          {burnout && burnout.risk_level !== 'UNKNOWN' ? (
            <>
              <ProgressBar
                value={(burnout.predicted_burnout_risk ?? 0) * 100}
                color={riskColor(burnout.predicted_burnout_risk ?? 0)}
                showLabel
                height="md"
                className="mb-3"
              />
              <p className="text-sm text-slate-300 leading-relaxed">{burnout.recommendation}</p>
              <p className="text-xs text-slate-500 mt-2">
                Basé sur{' '}
                <span className="font-mono text-brand-primary">{burnout.based_on_days}</span>{' '}
                jours d'historique
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Pas encore assez de données pour la prédiction. Créez des tâches et utilisez le planning.</p>
          )}
        </Card>

        {/* Today's Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>📅 Planning du jour</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/planning')}>
              Voir tout <ArrowRight size={12} />
            </Button>
          </CardHeader>

          {schedule.length > 0 ? (
            <div className="space-y-1.5">
              {schedule.slice(0, 6).map((slot, i) => {
                const dur = Math.round(
                  (new Date(slot.end_at).getTime() - new Date(slot.start_at).getTime()) / 60000
                )
                return (
                  <div
                    key={i}
                    className={`flex gap-3 items-start p-2.5 rounded-lg border-l-2 transition-colors hover:bg-dark-card2 ${
                      slot.is_break ? 'border-dark-border2' : 'border-brand-primary/60'
                    }`}
                  >
                    <div className="text-xs font-mono text-slate-400 min-w-[88px] pt-0.5">
                      {fmtTime(slot.start_at)} – {fmtTime(slot.end_at)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        {slot.is_break ? '☕ Pause' : slot.task_title ?? 'Tâche'}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {dur} min{slot.ai_generated && ' • ✨ IA'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon="📅"
              title="Aucun planning pour aujourd'hui"
              action={{ label: 'Générer le planning', onClick: () => navigate('/planning') }}
            />
          )}
        </Card>
      </div>

      {/* Row 3: Top tasks + Quick add */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top priorities */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Top priorités</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
              Tout voir <ArrowRight size={12} />
            </Button>
          </CardHeader>

          {topTasks.length > 0 ? (
            <div className="space-y-2.5">
              {topTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="text-xs font-mono text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded min-w-[38px] text-center">
                    {t.score.toFixed(1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={t.priority}>{PRIORITY_LABELS[t.priority]}</Badge>
                      <span className="text-xs font-mono text-slate-500">{t.estimated_duration_minutes}min</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="✅" title="Toutes les tâches sont terminées !" />
          )}
        </Card>

        {/* Quick Add */}
        <Card>
          <CardHeader><CardTitle>⚡ Ajout rapide</CardTitle></CardHeader>

          <div className="space-y-3">
            <Input
              label="Titre de la tâche"
              placeholder="Ex: Préparer la présentation"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickTitle.trim()) quickAddMutation.mutate()
              }}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select className="w-full bg-slate-700 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-primary"
                label="Priorité"
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as Priority)}
                options={[
                  { value: 'low', label: 'Basse' },
                  { value: 'medium', label: 'Moyenne' },
                  { value: 'high', label: 'Haute' },
                  { value: 'critical', label: 'Critique' },
                ]}
              />
              <Select className="w-full bg-slate-700 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-primary"
                label="Énergie"
                value={quickEnergy}
                onChange={(e) => setQuickEnergy(e.target.value as EnergyRequired)}
                options={[
                  { value: 'low', label: 'Faible' },
                  { value: 'medium', label: 'Moyenne' },
                  { value: 'high', label: 'Élevée' },
                ]}
              />
            </div>
            <div className="flex items-end gap-3">
              <Input
                label="Durée (min)"
                type="number"
                min={5}
                max={480}
                value={quickDuration}
                onChange={(e) => setQuickDuration(parseInt(e.target.value) || 30)}
                className="flex-1"
              />
              <Button
                variant="primary"
                fullWidth
                loading={quickAddMutation.isPending}
                disabled={!quickTitle.trim()}
                onClick={() => quickAddMutation.mutate()}
                className="flex-1"
              >
                <Plus size={14} /> Ajouter
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Task Modal */}
      <Modal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Nouvelle tâche" size="lg">
        <TaskForm onSuccess={() => setTaskModalOpen(false)} />
      </Modal>
    </div>
  )
}
