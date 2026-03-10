import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { tasksApi } from '@/api/tasks'
import { TaskCard } from '@/components/tasks/TaskCard'
import { TaskForm } from '@/components/tasks/TaskForm'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState, LoadingPage } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { Task, TaskStatus, Priority } from '@/types'

const STATUS_FILTERS: Array<{ value: TaskStatus | ''; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminées' },
  { value: 'postponed', label: 'Reportées' },
  { value: 'cancelled', label: 'Annulées' },
]

const PRIORITY_FILTERS: Array<{ value: Priority | ''; label: string }> = [
  { value: '', label: 'Toutes priorités' },
  { value: 'critical', label: '🔴 Critique' },
  { value: 'high', label: '🟠 Haute' },
  { value: 'medium', label: '🟡 Moyenne' },
  { value: 'low', label: '🟢 Basse' },
]

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', statusFilter, priorityFilter],
    queryFn: () => tasksApi.list({ status: statusFilter || undefined, priority: priorityFilter || undefined }),
    staleTime: 15_000,
  })

  function handleEdit(task: Task) {
    setEditTask(task)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setEditTask(null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes Tâches</h1>
          <p className="text-sm text-slate-400 mt-1">
            <span className="font-mono text-brand-primary">{tasks.length}</span> tâche{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="primary" onClick={() => { setEditTask(null); setModalOpen(true) }}>
          <Plus size={14} /> Nouvelle tâche
        </Button>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
              statusFilter === value
                ? 'bg-brand-primary/15 border-brand-primary text-brand-primary'
                : 'bg-dark-card border-dark-border text-slate-400 hover:text-slate-200 hover:border-dark-border2'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Priority pills */}
      <div className="flex gap-2 flex-wrap">
        {PRIORITY_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPriorityFilter(value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
              priorityFilter === value
                ? 'bg-brand-primary/15 border-brand-primary text-brand-primary'
                : 'bg-dark-card border-dark-border text-slate-400 hover:text-slate-200 hover:border-dark-border2'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <LoadingPage />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Aucune tâche trouvée"
          description="Créez votre première tâche pour commencer à organiser votre journée."
          action={{ label: 'Créer une tâche', onClick: () => setModalOpen(true) }}
        />
      ) : (
        <div className="grid gap-2.5">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
        size="lg"
      >
        <TaskForm task={editTask} onSuccess={handleCloseModal} />
      </Modal>
    </div>
  )
}
