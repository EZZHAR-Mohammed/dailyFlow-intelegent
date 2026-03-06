import React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg border whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:
      'bg-brand-primary border-brand-primary text-white hover:bg-brand-hover hover:shadow-glow active:scale-[0.98]',
    secondary:
      'bg-dark-card2 border-dark-border2 text-slate-200 hover:bg-dark-border hover:border-dark-border2',
    danger:
      'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
    success:
      'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20',
    ghost:
      'bg-transparent border-transparent text-slate-400 hover:bg-dark-card hover:text-slate-200',
    outline:
      'bg-transparent border-dark-border2 text-slate-300 hover:border-brand-primary hover:text-brand-primary',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
    icon: 'p-2 text-sm',
  }

  return (
    <button
      className={cn(
        base,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
