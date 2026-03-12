import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, SkipForward, Check, Clock, Tag, AlertCircle } from 'lucide-react'
import { tasksApi } from '@/api/tasks'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  PRIORITY_LABELS, STATUS_LABELS,
  fmtDate, getDueDateStatus, cn, getApiError
} from '@/lib/utils'
import type { Task } from '@/types'
import toast from 'react-hot-toast'

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const isDone = task.status === 'done'

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['analytics'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const doneMutation = useMutation({
    mutationFn: () => tasksApi.markDone(task.id),
    onSuccess: () => { toast.success('Tâche terminée ✅'); invalidate() },
    onError: (e) => toast.error(getApiError(e)),
  })

  const postponeMutation = useMutation({
    mutationFn: () => tasksApi.postpone(task.id),
    onSuccess: () => { toast.success('Tâche reportée ⏭'); invalidate() },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => { toast.success('Tâche supprimée'); invalidate() },
    onError: (e) => toast.error(getApiError(e)),
  })

  const dueStatus = getDueDateStatus(task.due_date)
  const dueDateClasses = {
    overdue: 'text-red-400',
    soon: 'text-amber-400',
    normal: 'text-slate-500',
  }

  const tags = task.tags ? task.tags.split(',').map((t) => t.trim()).filter(Boolean) : []

  return (
    <div
      className={cn(
        'bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200',
        'hover:border-dark-border2 hover:-translate-y-px hover:shadow-card',
        isDone && 'opacity-55'
      )}
    >
      {/* Top row: checkbox + title + priority */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => !isDone && doneMutation.mutate()}
          disabled={isDone || doneMutation.isPending}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all',
            isDone
              ? 'bg-emerald-500 border-emerald-500'
              : 'border-dark-border2 hover:border-emerald-500/70'
          )}
        >
          {isDone && <Check size={12} className="text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-medium leading-snug', isDone && 'line-through text-slate-400')}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description}</p>
          )}
        </div>

        <Badge variant={task.priority}>{PRIORITY_LABELS[task.priority]}</Badge>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Badge variant={task.status}>{STATUS_LABELS[task.status]}</Badge>

        <span className="flex items-center gap-1 text-xs text-slate-500 font-mono">
          <Clock size={11} /> {task.estimated_duration_minutes}min
        </span>

        {task.due_date && (
          <span className={cn('flex items-center gap-1 text-xs font-mono', dueStatus ? dueDateClasses[dueStatus] : 'text-slate-500')}>
            {dueStatus === 'overdue' && <AlertCircle size={11} />}
            {fmtDate(task.due_date)}
          </span>
        )}

        {task.postpone_count > 0 && (
          <span className="text-[11px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
            ↩️ ×{task.postpone_count}
          </span>
        )}

        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-[11px] text-slate-500 bg-dark-surface border border-dark-border px-1.5 py-0.5 rounded-full">
            <Tag size={9} />{tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dark-border">
        {!isDone && task.status !== 'cancelled' && (
          <Button
            variant="success" size="sm"
            loading={doneMutation.isPending}
            onClick={() => doneMutation.mutate()}
          >
            <Check size={12} /> Done
          </Button>
        )}

        {task.status !== 'done' && task.status !== 'cancelled' && (
          <Button
            variant="secondary" size="sm"
            loading={postponeMutation.isPending}
            onClick={() => postponeMutation.mutate()}
          >
            <SkipForward size={12} /> Reporter
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={() => onEdit(task)}>
          <Pencil size={12} /> Modifier
        </Button>

        <div className="ml-auto">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Confirmer ?</span>
              <Button
                variant="danger" size="sm"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                Oui
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Non
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setConfirming(true)}>
              <Trash2 size={13} className="text-slate-500 hover:text-red-400" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
