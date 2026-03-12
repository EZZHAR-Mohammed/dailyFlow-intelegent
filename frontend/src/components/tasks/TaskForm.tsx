import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tasksApi } from '@/api/tasks'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getApiError } from '@/lib/utils'
import type { Task } from '@/types'
import toast from 'react-hot-toast'

const schema = z.object({
  title: z.string().min(1, 'Titre requis').max(255),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  energy_required: z.enum(['low', 'medium', 'high']),
  estimated_duration_minutes: z
    .number({ invalid_type_error: 'Durée invalide' })
    .min(5, 'Min 5 min')
    .max(480, 'Max 480 min'),
  due_date: z.string().optional(),
  tags: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TaskFormProps {
  task?: Task | null
  onSuccess: () => void
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🟢 Basse' },
  { value: 'medium', label: '🟡 Moyenne' },
  { value: 'high', label: '🟠 Haute' },
  { value: 'critical', label: '🔴 Critique' },
]

const ENERGY_OPTIONS = [
  { value: 'low', label: '💤 Faible' },
  { value: 'medium', label: '⚡ Moyenne' },
  { value: 'high', label: '🔥 Élevée' },
]

export function TaskForm({ task, onSuccess }: TaskFormProps) {
  const qc = useQueryClient()
  const isEdit = !!task

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'medium',
      energy_required: 'medium',
      estimated_duration_minutes: 30,
    },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        energy_required: task.energy_required,
        estimated_duration_minutes: task.estimated_duration_minutes,
        due_date: task.due_date ?? '',
        tags: task.tags ?? '',
      })
    } else {
      reset({ priority: 'medium', energy_required: 'medium', estimated_duration_minutes: 30 })
    }
  }, [task, reset])

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['tasks'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['analytics'] })
  }

  const createMutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => { toast.success('Tâche créée ✅'); invalidate(); onSuccess() },
    onError: (e) => toast.error(getApiError(e)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => tasksApi.update(task!.id, data),
    onSuccess: () => { toast.success('Tâche mise à jour ✅'); invalidate(); onSuccess() },
    onError: (e) => toast.error(getApiError(e)),
  })

  function onSubmit(data: FormValues) {
    const payload = {
      ...data,
      description: data.description || undefined,
      due_date: data.due_date || undefined,
      tags: data.tags || undefined,
    }
    if (isEdit) updateMutation.mutate(data)
    else createMutation.mutate(payload)
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="Titre *"
        placeholder="Ex: Préparer la présentation Q4"
        error={errors.title?.message}
        {...register('title')}
      />

      <Textarea
        label="Description"
        placeholder="Détails optionnels…"
        {...register('description')}
      />

      <div className="grid grid-cols-2 gap-3">
        <Select className="w-full bg-slate-700 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-primary"
          label="Priorité"
          options={PRIORITY_OPTIONS}
          error={errors.priority?.message}
          {...register('priority')}
        />
        <Select  className="w-full bg-slate-700 border border-slate-500 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-brand-primary"
          label="Énergie requise"
          options={ENERGY_OPTIONS}
          error={errors.energy_required?.message}
          {...register('energy_required')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Durée (minutes) *"
          type="number"
          min={5}
          max={480}
          error={errors.estimated_duration_minutes?.message}
          {...register('estimated_duration_minutes', { valueAsNumber: true })}
        />
        <Input
          label="Date limite"
          type="date"
          {...register('due_date')}
        />
      </div>

      <Input
        label="Tags"
        placeholder="urgent, client, design"
        hint="Séparés par des virgules"
        {...register('tags')}
      />

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" fullWidth onClick={onSuccess}>
          Annuler
        </Button>
        <Button type="submit" variant="primary" fullWidth loading={isPending}>
          {isEdit ? 'Sauvegarder' : 'Créer la tâche'}
        </Button>
      </div>
    </form>
  )
}
