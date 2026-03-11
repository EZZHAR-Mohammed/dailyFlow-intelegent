import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { planningApi } from '@/api/planning'
import { tasksApi } from '@/api/tasks'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, LoadingPage, Spinner } from '@/components/ui/EmptyState'
import {
  today, fmtTime, fmtDate, slotDuration,
  DAY_LABELS, ENERGY_PERIOD_LABELS, getApiError,
  PRIORITY_LABELS, computeTaskScore
} from '@/lib/utils'
import type { ScheduledSlot, DayOfWeek, AIRecommendation, Priority, Task } from '@/types'
import toast from 'react-hot-toast'
import {
  GripVertical, Trash2, Plus, Sparkles,
  AlertTriangle, Info, Check, Eye, Pencil, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface ManualSlot {
  id: string          // client-only id for DnD
  task_id: number
  task_title: string
  start_time: string  // "HH:MM"
  duration_minutes: number
  priority: Priority
  status?: string     // task status: done | in_progress | pending | cancelled
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME UTILS
// ─────────────────────────────────────────────────────────────────────────────
function calcEndTime(startTime: string, durationMinutes: number): string {
  if (!startTime) return '—'
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + durationMinutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function toISODateTime(date: string, time: string): string {
  return `${date}T${time}:00`
}

// ─────────────────────────────────────────────────────────────────────────────
// SORTABLE ROW
// ─────────────────────────────────────────────────────────────────────────────
function SortableSlotRow({
  slot, onRemove, onTimeChange, onDurationChange
}: {
  slot: ManualSlot
  onRemove: (id: string) => void
  onTimeChange: (id: string, time: string) => void
  onDurationChange: (id: string, min: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slot.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  const endTime = calcEndTime(slot.start_time, slot.duration_minutes)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border bg-dark-surface transition-colors',
        isDragging ? 'border-brand-primary/60 shadow-lg' : 'border-dark-border'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-slate-600 hover:text-slate-300 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        title="Glisser pour réordonner"
      >
        <GripVertical size={18} />
      </button>

      {/* Task name + priority */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${slot.status === 'done' ? 'line-through opacity-50' : ''}`}>{slot.task_title}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Badge variant={slot.priority} className="text-[10px]">{PRIORITY_LABELS[slot.priority]}</Badge>
          {slot.status === 'done' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">✅ Terminé</span>}
          {slot.status === 'in_progress' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">⚡ En cours</span>}
          {slot.status === 'cancelled' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">❌ Annulé</span>}
        </div>
      </div>

      {/* Start time */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Début</span>
        <input
          type="time"
          value={slot.start_time}
          onChange={(e) => onTimeChange(slot.id, e.target.value)}
          className="w-24 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50"
        />
      </div>

      {/* Duration */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Durée (min)</span>
        <input
          type="number"
          min={5}
          max={480}
          value={slot.duration_minutes}
          onChange={(e) => onDurationChange(slot.id, parseInt(e.target.value) || 30)}
          className="w-20 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50"
        />
      </div>

      {/* End time (read-only) */}
      <div className="flex flex-col gap-1 flex-shrink-0 w-16">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Fin</span>
        <div className="text-xs font-mono text-slate-400 py-1.5">{endTime}</div>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(slot.id)}
        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
        title="Supprimer"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function PlanningPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Planning</h1>
      <Tabs defaultValue="classic">
        <TabsList>
          <TabsTrigger value="classic">📅 Planning Manuel</TabsTrigger>
          <TabsTrigger value="ai">✨ IA Multi-tâches</TabsTrigger>
          <TabsTrigger value="config">⚙️ Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="classic"><ClassicTab /></TabsContent>
        <TabsContent value="ai"><AITab /></TabsContent>
        <TabsContent value="config"><ConfigTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIC TAB — Manual planning with DnD + time picker + persistent to DB
// ─────────────────────────────────────────────────────────────────────────────
function ClassicTab() {
  const qc = useQueryClient()
  const [planDate, setPlanDate] = useState(today())
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [slots, setSlots] = useState<ManualSlot[]>([])
  const [loadedDate, setLoadedDate] = useState('')

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksApi.list(),
    staleTime: 30_000,
  })

  const { data: savedSchedule = [], isLoading: loadingSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['schedule-manual', planDate],
    queryFn: () => planningApi.getSchedule(planDate, 'manual'),
    staleTime: 0,
    gcTime: 0,
  })

  const { data: avails = [] } = useQuery({
    queryKey: ['availabilities'],
    queryFn: planningApi.listAvailabilities,
    staleTime: 60_000,
  })

  // Load DB → slots whenever date or savedSchedule changes (and tasks are ready)
  useEffect(() => {
    if (loadingSchedule || loadingTasks) return
    if (loadedDate === planDate) return
    const dbSlots = savedSchedule.filter(s => !s.is_break && s.task_id != null)
    setSlots(dbSlots.map(s => {
      const task = tasks.find(t => t.id === s.task_id)
      const dur = slotDuration(s.start_at, s.end_at)
      return {
        id: `db-${s.task_id}-${s.start_at}`,
        task_id: s.task_id!,
        task_title: s.task_title ?? task?.title ?? 'Tâche',
        start_time: fmtTime(s.start_at),
        duration_minutes: dur > 0 ? dur : (task?.estimated_duration_minutes ?? 30),
        priority: (task?.priority ?? 'medium') as Priority,
        status: task?.status,
      }
    }))
    setLoadedDate(planDate)
  }, [savedSchedule, tasks, planDate, loadingSchedule, loadingTasks, loadedDate])

  // Reset on date change
  useEffect(() => { setLoadedDate('') }, [planDate])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id)
      setSlots(prev => arrayMove(prev, prev.findIndex(s => s.id === active.id), prev.findIndex(s => s.id === over.id)))
  }

  const availableTasks = tasks.filter(
    t => t.status !== 'done' && t.status !== 'cancelled' && !slots.find(s => s.task_id === t.id)
  )

  function addTask() {
    if (!selectedTaskId) { toast.error('Sélectionnez une tâche'); return }
    const task = tasks.find(t => t.id === parseInt(selectedTaskId))
    if (!task) return
    let start = '09:00'
    if (slots.length > 0) {
      const last = slots[slots.length - 1]
      start = calcEndTime(last.start_time, last.duration_minutes)
    }
    setSlots(prev => [...prev, {
      id: `new-${task.id}-${Date.now()}`,
      task_id: task.id,
      task_title: task.title,
      start_time: start,
      duration_minutes: task.estimated_duration_minutes,
      priority: task.priority,
      status: task.status,
    }])
    setSelectedTaskId('')
  }

  async function removeSlot(id: string) {
    const newSlots = slots.filter(s => s.id !== id)
    setSlots(newSlots)
    // Save immediately to DB so refresh reflects the deletion
    try {
      await planningApi.saveManualPlan(planDate, newSlots.map(s => ({
        task_id: s.task_id,
        start_at: toISODateTime(planDate, s.start_time),
        end_at: toISODateTime(planDate, calcEndTime(s.start_time, s.duration_minutes)),
        is_break: false,
        ai_generated: false,
      })), 'manual')
      toast.success(newSlots.length === 0 ? 'Planning vidé ✅' : 'Tâche supprimée ✅')
      setLoadedDate(planDate)
    } catch (e) {
      toast.error(getApiError(e))
      setSlots(slots) // rollback on error
    }
  }
  function updateTime(id: string, t: string) { setSlots(prev => prev.map(s => s.id === id ? { ...s, start_time: t } : s)) }
  function updateDuration(id: string, m: number) { setSlots(prev => prev.map(s => s.id === id ? { ...s, duration_minutes: Math.max(5, m) } : s)) }
  function sortByPriority() {
    const w: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    setSlots(prev => [...prev].sort((a, b) => w[b.priority] - w[a.priority]))
    toast.success('Triées par priorité')
  }
  function sortByTime() {
    setSlots(prev => [...prev].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    toast.success('Triées par horaire')
  }

  const overlappingIds = new Set<string>()
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j]
      const aEnd = calcEndTime(a.start_time, a.duration_minutes)
      const bEnd = calcEndTime(b.start_time, b.duration_minutes)
      if (a.start_time < bEnd && aEnd > b.start_time) {
        overlappingIds.add(a.id); overlappingIds.add(b.id)
      }
    }
  }

  async function handleSave() {
    if (!slots.length) { toast.error('Ajoutez au moins une tâche'); return }
    setIsSaving(true)
    try {
      await planningApi.saveManualPlan(planDate, slots.map(s => ({
        task_id: s.task_id,
        start_at: toISODateTime(planDate, s.start_time),
        end_at: toISODateTime(planDate, calcEndTime(s.start_time, s.duration_minutes)),
        is_break: false,
        ai_generated: false,
      })), 'manual')
      toast.success('Planning sauvegardé ✅')
      // Slots stay visible — loadedDate stays at planDate so useEffect won't reload
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleClear() {
    setSlots([])
    setLoadedDate(planDate)
    try {
      await planningApi.saveManualPlan(planDate, [], 'manual')
      await refetchSchedule()
      toast.success('Planning vidé')
    } catch {}
  }

  const totalMin = slots.reduce((acc, s) => acc + s.duration_minutes, 0)
  const dayName = new Date(planDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayAvails = avails.filter(a => a.day_of_week === dayName)

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <Input label="Date du planning" type="date" value={planDate}
              onChange={(e) => setPlanDate(e.target.value)} />
          </div>
          <div className="flex gap-2 pb-0.5">
            <Button variant="ghost" size="sm" onClick={sortByPriority}>⬆ Priorité</Button>
            <Button variant="ghost" size="sm" onClick={sortByTime}>🕐 Horaire</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planning — {fmtDate(planDate)}</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            {dayAvails.length > 0 ? dayAvails.map(a => (
              <span key={a.id} className="bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-mono">
                ⚙️ {a.start_time.slice(0,5)}–{a.end_time.slice(0,5)}
              </span>
            )) : <span className="text-amber-400/70 text-xs">⚙️ 09:00–18:00 défaut</span>}
          </div>
        </CardHeader>

        {/* Add task — always visible */}
        <div className="flex gap-3 items-end mb-5 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Select
              label="Ajouter une tâche"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              options={[
                { value: '', label: availableTasks.length ? 'Sélectionner une tâche…' : 'Toutes les tâches ajoutées' },
                ...availableTasks
                  .sort((a, b) => computeTaskScore(b) - computeTaskScore(a))
                  .map(t => ({ value: String(t.id), label: `[${t.priority.toUpperCase()}] ${t.title} — ${t.estimated_duration_minutes}min` })),
              ]}
            />
          </div>
          <Button variant="primary" onClick={addTask} disabled={!selectedTaskId}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>

        {slots.length > 0 && (
          <div className="flex items-center gap-5 px-4 py-3 bg-dark-surface rounded-xl text-xs text-slate-400 mb-4 flex-wrap">
            <span>📋 <strong className="text-slate-200 font-mono">{slots.length}</strong> tâche{slots.length > 1 ? 's' : ''}</span>
            <span>⏱ <strong className="text-slate-200 font-mono">{(totalMin / 60).toFixed(1)}h</strong></span>
            {overlappingIds.size > 0 && (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <AlertTriangle size={12} />
                {overlappingIds.size / 2} chevauchement{overlappingIds.size / 2 > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {loadingTasks || loadingSchedule ? (
          <div className="flex items-center justify-center py-12"><Spinner size={24} /></div>
        ) : slots.length === 0 ? (
          <EmptyState icon="📅" title="Aucune tâche dans le planning"
            description="Sélectionnez une tâche dans le menu ci-dessus puis cliquez sur Ajouter." />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={slots.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {slots.map(slot => (
                  <div key={slot.id}>
                    <SortableSlotRow slot={slot} onRemove={removeSlot} onTimeChange={updateTime} onDurationChange={updateDuration} />
                    {overlappingIds.has(slot.id) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400 px-4 py-1">
                        <AlertTriangle size={10} /> Chevauchement avec une autre tâche
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {slots.length > 0 && (
          <div className="flex gap-3 mt-5 pt-4 border-t border-dark-border">
            <Button variant="ghost" size="sm" onClick={handleClear}>🗑 Vider</Button>
            <Button variant="primary" fullWidth loading={isSaving} onClick={handleSave}>
              <Check size={14} /> Sauvegarder ({slots.length} tâche{slots.length > 1 ? 's' : ''})
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

function ScheduleView({
  date, slots, isLoading, tasks = []
}: {
  date: string
  slots: ScheduledSlot[]
  isLoading: boolean
  tasks?: Task[]
}) {
  if (isLoading) return <LoadingPage />

  if (!slots.length) {
    return (
      <EmptyState
        icon="📅"
        title="Aucun planning sauvegardé pour cette date"
        description="Passez en mode Édition, composez votre planning et sauvegardez."
      />
    )
  }

  const priorityColor: Record<string, string> = {
    critical: '#EF4444', high: '#F97316', medium: '#F59E0B', low: '#10B981'
  }
  const STATUS_STYLE: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    done:        { bg: '#10B98120', text: '#10B981', label: 'Terminé',     icon: '✅' },
    in_progress: { bg: '#6366F120', text: '#6366F1', label: 'En cours',    icon: '⚡' },
    pending:     { bg: '#F59E0B20', text: '#F59E0B', label: 'À faire',     icon: '⏳' },
    cancelled:   { bg: '#EF444420', text: '#EF4444', label: 'Annulé',      icon: '❌' },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planning du {fmtDate(date)}</CardTitle>
        <Badge variant="ai">✨ {slots.length} créneaux</Badge>
      </CardHeader>

      <div className="relative pl-20">
        {/* Vertical timeline line */}
        <div className="absolute left-[72px] top-2 bottom-2 w-px bg-dark-border2" />

        <div className="space-y-3">
          {slots.map((slot, i) => {
            const isBreak = slot.is_break
            const dur = slotDuration(slot.start_at, slot.end_at)
            const color = isBreak ? '#334155' : '#6366F1'

            return (
              <div key={i} className="relative flex items-start gap-4 min-h-[52px]">
                {/* Start time */}
                <div className="absolute -left-20 w-16 text-right text-xs font-mono text-slate-500 pt-4">
                  {fmtTime(slot.start_at)}
                </div>

                {/* Timeline dot */}
                <div
                  className="absolute left-0 top-4 w-3 h-3 rounded-full border-2 border-dark-bg flex-shrink-0"
                  style={{ background: color, marginLeft: '-6px' }}
                />

                {/* Slot card */}
                <div
                  className="flex-1 ml-5 p-3.5 rounded-xl transition-all hover:brightness-110"
                  style={{
                    background: `${color}12`,
                    borderLeft: `3px solid ${color}80`,
                  }}
                >
                  {(() => {
                    const task = tasks.find(t => t.id === slot.task_id)
                    const status = task?.status ?? 'pending'
                    const ss = STATUS_STYLE[status] ?? STATUS_STYLE.pending
                    const isDone = status === 'done'
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${isDone ? 'line-through opacity-60' : ''}`}>
                            {isBreak ? '☕ Pause' : slot.task_title ?? 'Tâche'}
                          </span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!isBreak && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: ss.bg, color: ss.text }}
                              >
                                {ss.icon} {ss.label}
                              </span>
                            )}
                            {slot.ai_generated && <Badge variant="ai">✨ IA</Badge>}
                            <span className="text-xs font-mono text-slate-500">
                              <Clock size={10} className="inline mr-1" />{dur} min
                            </span>
                          </div>
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-1">
                          {fmtTime(slot.start_at)} → {fmtTime(slot.end_at)}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI TAB — Generate, auto-save to DB, persist on refresh, edit/delete slots
// ─────────────────────────────────────────────────────────────────────────────
function AITab() {
  const qc = useQueryClient()
  const [aiDate, setAiDate] = useState(today())

  // ── DB: load saved AI schedule (persists across refresh) ─────────────
  const {
    data: savedSlots = [],
    isLoading: loadingSlots,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: ['schedule-ai', aiDate],    // isolated from manual tab
    queryFn: () => planningApi.getSchedule(aiDate, 'ai'),
    staleTime: 0,
    gcTime: 0,
  })

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksApi.list(),
    staleTime: 30_000,
  })

  const activeTasks = tasks
    .filter(t => t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => computeTaskScore(b) - computeTaskScore(a))

  // aiSlots = the AI slots in DB (not breaks)
  const aiSlots = savedSlots.filter(s => !s.is_break && s.task_id != null)
  const hasSchedule = aiSlots.length > 0

  // mode: 'view' → see saved table | 'edit' → modify | 'generate' → create new
  const [mode, setMode] = useState<'view' | 'edit' | 'generate'>('view')

  // When date changes → reset to view
  useEffect(() => { setMode('view') }, [aiDate])

  // ── Generate state ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [currentTask, setCurrentTask] = useState('')
  const [progress, setProgress] = useState(0)
  const [doneCount, setDoneCount] = useState(0)

  function toggleTask(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() { setSelectedIds(new Set(activeTasks.map(t => t.id))) }
  function clearAll() { setSelectedIds(new Set()) }

  async function runAI() {
    if (!selectedIds.size) { toast.error('Sélectionnez au moins une tâche'); return }
    const taskList = activeTasks.filter(t => selectedIds.has(t.id))
    setProcessing(true); setProgress(0); setDoneCount(0)

    const collected: Array<{ task_id: number; start_at: string; end_at: string }> = []
    let lastEndISO: string | undefined = undefined

    for (let i = 0; i < taskList.length; i++) {
      const task = taskList[i]
      setCurrentTask(task.title)
      setProgress(Math.round((i / taskList.length) * 100))
      try {
        const rec = await planningApi.aiRecommend(task.id, aiDate, lastEndISO)
        collected.push({ task_id: task.id, start_at: rec.recommended_slot_start, end_at: rec.recommended_slot_end })
        lastEndISO = rec.recommended_slot_end
        setDoneCount(i + 1)
      } catch (e) {
        const msg = getApiError(e)
        if (msg.includes('AI is disabled') || msg.includes('403')) {
          toast.error("⚠️ L'IA est désactivée — activez-la dans Paramètres → IA", { duration: 5000 })
          setProcessing(false); return
        }
        toast.error(`${task.title}: ${msg}`, { duration: 2500 })
      }
    }

    setProgress(100); setCurrentTask(''); setProcessing(false)
    if (!collected.length) return

    // ✅ Save immediately to DB → persists on refresh
    try {
      await planningApi.saveManualPlan(aiDate, collected.map(c => ({
        task_id: c.task_id,
        start_at: c.start_at,
        end_at: c.end_at,
        is_break: false,
        ai_generated: true,
      })), 'ai')
      await refetchSlots()
      setMode('view')
      toast.success(`✨ ${collected.length} tâche${collected.length > 1 ? 's' : ''} planifiée${collected.length > 1 ? 's' : ''} et sauvegardées ✅`)
    } catch (e) {
      toast.error('Sauvegarde échouée: ' + getApiError(e))
    }
  }

  // ── Edit state ────────────────────────────────────────────────────────
  const [editSlots, setEditSlots] = useState<ManualSlot[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // When entering edit mode, copy aiSlots → editSlots
  useEffect(() => {
    if (mode !== 'edit') return
    setEditSlots(aiSlots.map(s => {
      const task = tasks.find(t => t.id === s.task_id)
      const dur = slotDuration(s.start_at, s.end_at)
      return {
        id: `edit-${s.task_id}-${s.start_at}`,
        task_id: s.task_id!,
        task_title: s.task_title ?? task?.title ?? 'Tâche',
        start_time: fmtTime(s.start_at),
        duration_minutes: dur > 0 ? dur : (task?.estimated_duration_minutes ?? 30),
        priority: (task?.priority ?? 'medium') as Priority,
      }
    }))
  }, [mode])   // only re-run when mode changes

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setEditSlots(prev => arrayMove(prev, prev.findIndex(s => s.id === active.id), prev.findIndex(s => s.id === over.id)))
    }
  }
  async function removeEditSlot(id: string) {
    const newSlots = editSlots.filter(s => s.id !== id)
    setEditSlots(newSlots)
    try {
      await planningApi.saveManualPlan(aiDate, newSlots.map(s => ({
        task_id: s.task_id,
        start_at: toISODateTime(aiDate, s.start_time),
        end_at: toISODateTime(aiDate, calcEndTime(s.start_time, s.duration_minutes)),
        is_break: false,
        ai_generated: true,
      })), 'ai')
      toast.success(newSlots.length === 0 ? 'Planning vidé ✅' : 'Tâche supprimée ✅')
      await refetchSlots()
    } catch (e) {
      toast.error(getApiError(e))
      setEditSlots(editSlots) // rollback on error
    }
  }
  function updateEditTime(id: string, t: string) { setEditSlots(prev => prev.map(s => s.id === id ? { ...s, start_time: t } : s)) }
  function updateEditDuration(id: string, m: number) { setEditSlots(prev => prev.map(s => s.id === id ? { ...s, duration_minutes: Math.max(5, m) } : s)) }

  async function saveEdits() {
    setIsSaving(true)
    try {
      await planningApi.saveManualPlan(aiDate, editSlots.map(s => ({
        task_id: s.task_id,
        start_at: toISODateTime(aiDate, s.start_time),
        end_at: toISODateTime(aiDate, calcEndTime(s.start_time, s.duration_minutes)),
        is_break: false,
        ai_generated: true,
      })), 'ai')
      await refetchSlots()
      setMode('view')
      toast.success('Planning IA mis à jour ✅')
    } catch (e) {
      toast.error(getApiError(e))
    } finally {
      setIsSaving(false)
    }
  }

  // Overlap detection
  const overlappingIds = new Set<string>()
  for (let i = 0; i < editSlots.length; i++) {
    for (let j = i + 1; j < editSlots.length; j++) {
      const a = editSlots[i], b = editSlots[j]
      const aEnd = calcEndTime(a.start_time, a.duration_minutes)
      const bEnd = calcEndTime(b.start_time, b.duration_minutes)
      if (a.start_time < bEnd && aEnd > b.start_time) {
        overlappingIds.add(a.id); overlappingIds.add(b.id)
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Date picker + mode buttons */}
      <Card>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <Input label="Date cible" type="date" value={aiDate}
              onChange={(e) => setAiDate(e.target.value)} />
          </div>
          {/* Show mode buttons only when a schedule exists */}
          {hasSchedule && !loadingSlots && (
            <div className="flex gap-2 pb-0.5">
              <Button size="sm" variant={mode === 'view' ? 'primary' : 'secondary'} onClick={() => setMode('view')}>
                <Eye size={13} /> Voir
              </Button>
              <Button size="sm" variant={mode === 'edit' ? 'primary' : 'secondary'} onClick={() => setMode('edit')}>
                <Pencil size={13} /> Éditer
              </Button>
              <Button size="sm" variant={mode === 'generate' ? 'primary' : 'ghost'} onClick={() => setMode('generate')}>
                <Sparkles size={13} /> Regénérer
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Loading */}
      {(loadingSlots || loadingTasks) && (
        <div className="flex items-center justify-center py-16"><Spinner size={28} /></div>
      )}

      {/* ── VIEW: saved schedule from DB ── */}
      {!loadingSlots && !loadingTasks && mode === 'view' && hasSchedule && (
        <Card>
          <CardHeader>
            <CardTitle>✨ Planning IA — {fmtDate(aiDate)}</CardTitle>
            <Badge variant="ai">{aiSlots.length} créneau{aiSlots.length > 1 ? 'x' : ''}</Badge>
          </CardHeader>

          <div className="space-y-2">
            {[...aiSlots]
              .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
              .map((slot, i) => {
                const task = tasks.find(t => t.id === slot.task_id)
                const dur = slotDuration(slot.start_at, slot.end_at)
                return (
                  <div key={i} className="flex items-center gap-4 p-4 bg-dark-surface border border-dark-border rounded-xl">
                    <div className="text-center flex-shrink-0 w-24">
                      <div className="text-base font-bold font-mono text-brand-primary">{fmtTime(slot.start_at)}</div>
                      <div className="text-[11px] font-mono text-slate-500">→ {fmtTime(slot.end_at)}</div>
                      <div className="text-[11px] font-mono text-slate-600">{dur} min</div>
                    </div>
                    <div className="w-px h-12 bg-dark-border flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold truncate ${task?.status === 'done' ? 'line-through opacity-50' : ''}`}>
                        {slot.task_title ?? task?.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task && <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>}
                        {task?.status === 'done' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">✅ Terminé</span>}
                        {task?.status === 'in_progress' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">⚡ En cours</span>}
                        {task?.status === 'cancelled' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">❌ Annulé</span>}
                        {task?.energy_required && (
                          <span className="text-[11px] text-slate-500">⚡ {task.energy_required}</span>
                        )}
                        {task?.postpone_count != null && task.postpone_count > 0 && (
                          <span className="text-[11px] text-amber-400">↩️ ×{task.postpone_count}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="ai" className="flex-shrink-0">✨ IA</Badge>
                  </div>
                )
              })}
          </div>
        </Card>
      )}

      {/* ── EDIT: drag-drop modify ── */}
      {!loadingSlots && !loadingTasks && mode === 'edit' && (
        <Card>
          <CardHeader>
            <CardTitle>✏️ Modifier le planning IA — {fmtDate(aiDate)}</CardTitle>
          </CardHeader>

          {editSlots.length === 0 ? (
            <EmptyState icon="✨" title="Aucun créneau" description="Regénérez un planning IA d'abord" />
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={editSlots.map(s => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2 mb-5">
                    {editSlots.map(slot => (
                      <div key={slot.id}>
                        <SortableSlotRow slot={slot} onRemove={removeEditSlot}
                          onTimeChange={updateEditTime} onDurationChange={updateEditDuration} />
                        {overlappingIds.has(slot.id) && (
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-400 px-4 py-1">
                            <AlertTriangle size={10} /> Chevauchement
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="flex gap-3 pt-4 border-t border-dark-border">
                <Button variant="ghost" size="sm" onClick={() => setMode('view')}>Annuler</Button>
                <Button variant="primary" fullWidth loading={isSaving} onClick={saveEdits}>
                  <Check size={14} /> Sauvegarder les modifications
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── GENERATE: no schedule yet OR user clicked Regénérer ── */}
      {!loadingSlots && !loadingTasks && (mode === 'generate' || !hasSchedule) && (
        <Card>
          <CardHeader>
            <CardTitle>Générer un planning IA</CardTitle>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={selectAll}>Tout sélectionner</Button>
              <Button variant="ghost" size="sm" onClick={clearAll}>Tout désélectionner</Button>
            </div>
          </CardHeader>

          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-xs text-emerald-400">
            <Info size={12} className="flex-shrink-0" />
            <strong></strong>Créneaux sans chevauchement, tri par priorité.
          </div>

          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
            {selectedIds.size} / {activeTasks.length} tâche{activeTasks.length > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
          </div>

          {activeTasks.length === 0 ? (
            <EmptyState icon="✅" title="Aucune tâche active" />
          ) : (
            <div className="space-y-2 mb-5">
              {activeTasks.map(task => {
                const sel = selectedIds.has(task.id)
                return (
                  <div key={task.id}
                    onClick={() => !processing && toggleTask(task.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all',
                      processing ? 'cursor-default' : 'cursor-pointer',
                      sel ? 'bg-brand-primary/10 border-brand-primary/40' : 'bg-dark-surface border-dark-border hover:border-dark-border2'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      sel ? 'bg-brand-primary border-brand-primary' : 'border-dark-border2'
                    )}>
                      {sel && <Check size={11} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{task.title}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
                        <span className="text-xs font-mono text-slate-500">
                          <Clock size={10} className="inline mr-0.5" />{task.estimated_duration_minutes}min
                        </span>
                        {task.postpone_count > 0 && (
                          <span className="text-[11px] text-amber-400">↩️ ×{task.postpone_count}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-mono text-brand-primary/80 bg-brand-primary/10 px-2 py-1 rounded-lg min-w-[36px] text-center">
                      {computeTaskScore(task).toFixed(1)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {processing && (
            <div className="mb-4 p-4 bg-dark-surface rounded-xl border border-dark-border">
              <div className="flex items-center gap-3 mb-2">
                <Spinner size={14} />
                <span className="text-sm">Analyse : <strong>{currentTask}</strong></span>
                <span className="ml-auto text-xs font-mono text-slate-500">{doneCount}/{selectedIds.size}</span>
              </div>
              <div className="h-1.5 bg-dark-border rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-primary to-brand-violet rounded-full transition-all"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <Button variant="primary" fullWidth loading={processing}
            disabled={!selectedIds.size || processing} onClick={runAI}>
            <Sparkles size={14} />
            Générer et sauvegarder ({selectedIds.size} tâche{selectedIds.size > 1 ? 's' : ''})
          </Button>
        </Card>
      )}

    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// CONFIG TAB
// ─────────────────────────────────────────────────────────────────────────────
function ConfigTab() {
  const qc = useQueryClient()

  const { data: avails = [] } = useQuery({
    queryKey: ['availabilities'],
    queryFn: planningApi.listAvailabilities,
    staleTime: 60_000,
  })

  const [newDay, setNewDay] = useState<DayOfWeek>('monday')
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('17:00')

  const createMut = useMutation({
    mutationFn: () => planningApi.createAvailability({
      day_of_week: newDay,
      start_time: newStart + ':00',
      end_time: newEnd + ':00',
    }),
    onSuccess: () => { toast.success('Disponibilité ajoutée ✅'); qc.invalidateQueries({ queryKey: ['availabilities'] }) },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => planningApi.deleteAvailability(id),
    onSuccess: () => { toast.success('Supprimée'); qc.invalidateQueries({ queryKey: ['availabilities'] }) },
    onError: (e) => toast.error(getApiError(e)),
  })

  const { data: energyProfiles = [] } = useQuery({
    queryKey: ['energy'],
    queryFn: planningApi.listEnergy,
    staleTime: 60_000,
  })
  const profileMap = Object.fromEntries(energyProfiles.map(p => [p.period, p.energy_level]))
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const upsertMut = useMutation({
    mutationFn: planningApi.upsertEnergy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['energy'] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  function handleEnergy(period: string, v: number) {
    clearTimeout(debounceRefs.current[period])
    debounceRefs.current[period] = setTimeout(() => {
      upsertMut.mutate({ period: period as any, energy_level: v })
      toast.success(`Énergie ${period} → ${v}/10`)
    }, 600)
  }

  return (
    <div className="space-y-4">
      {/* Explanation banner */}
      <div className="flex items-start gap-3 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl text-sm text-emerald-300">
        <Info size={15} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-emerald-200">Ces paramètres sont utilisés à chaque génération de planning.</strong>
          <br/>Les disponibilités définissent les créneaux horaires disponibles pour chaque jour.
          L'énergie aide l'IA à choisir le meilleur moment pour chaque type de tâche.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
      {/* Availabilities */}
      <Card>
        <CardHeader><CardTitle>📆 Disponibilités hebdomadaires</CardTitle></CardHeader>
        {avails.length === 0 ? (
          <p className="text-sm text-slate-500 mb-4">Aucune disponibilité — défaut 09:00–18:00 utilisé</p>
        ) : (
          <div className="space-y-1.5 mb-4">
            {avails.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2.5 bg-dark-surface border border-dark-border rounded-lg">
                <span className="text-sm font-medium min-w-[80px]">{DAY_LABELS[a.day_of_week] ?? a.day_of_week}</span>
                <span className="text-xs font-mono text-slate-400">{a.start_time.slice(0, 5)} → {a.end_time.slice(0, 5)}</span>
                <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(a.id)}>🗑</Button>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-dark-border pt-4 space-y-3">
          <Select label="Jour" value={newDay} onChange={e => setNewDay(e.target.value as DayOfWeek)}
            options={Object.entries(DAY_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Début" type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
            <Input label="Fin" type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
          </div>
          <Button variant="primary" fullWidth loading={createMut.isPending} onClick={() => createMut.mutate()}>
            + Ajouter
          </Button>
        </div>
      </Card>

      {/* Energy */}
      <Card>
        <CardHeader><CardTitle>⚡ Profil Énergie</CardTitle></CardHeader>
        <p className="text-xs text-slate-500 mb-4">
          L'IA utilise votre énergie par période pour optimiser les créneaux recommandés.
        </p>
        <div className="space-y-3">
          {ENERGY_PERIOD_LABELS.map(({ key, label, sub }) => (
            <EnergySlider key={key} period={key} label={label} sub={sub}
              initialValue={profileMap[key] ?? 5} onChange={v => handleEnergy(key, v)} />
          ))}
        </div>
      </Card>
      </div>
    </div>
  )
}

function EnergySlider({ period, label, sub, initialValue, onChange }: {
  period: string; label: string; sub: string; initialValue: number; onChange: (v: number) => void
}) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => setValue(initialValue), [initialValue])
  const color = value >= 7 ? '#10B981' : value >= 4 ? '#F59E0B' : '#EF4444'
  return (
    <div className="p-3 bg-dark-surface border border-dark-border rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
        <div className="text-sm font-mono font-bold" style={{ color }}>{value}/10</div>
      </div>
      <input type="range" min={1} max={10} value={value} style={{ accentColor: color }}
        className="w-full h-1 rounded-full outline-none cursor-pointer"
        onChange={e => { const v = parseInt(e.target.value); setValue(v); onChange(v) }} />
    </div>
  )
}