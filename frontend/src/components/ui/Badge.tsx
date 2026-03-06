import { cn } from '@/lib/utils'
import type { Priority, TaskStatus, BurnoutLabel } from '@/types'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | Priority | TaskStatus | BurnoutLabel | 'ai' | 'info'
  className?: string
}

const variantClasses: Record<string, string> = {
  default: 'bg-slate-700/50 text-slate-300 border-slate-600/30',
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  pending: 'bg-slate-600/20 text-slate-400 border-slate-500/20',
  scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  in_progress: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  done: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  postponed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelled: 'bg-red-500/8 text-red-300/70 border-red-500/15',
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH: 'bg-red-500/10 text-red-400 border-red-500/20',
  ai: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
        variantClasses[variant] ?? variantClasses.default,
        className
      )}
    >
      {children}
    </span>
  )
}
