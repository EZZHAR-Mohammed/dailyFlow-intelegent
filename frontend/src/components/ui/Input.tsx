import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'w-full bg-dark-surface border border-dark-border2 rounded-lg px-3.5 py-2.5',
            'text-sm text-slate-100 placeholder:text-slate-600 font-sans',
            'transition-all duration-200 outline-none',
            'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            // Forçage dark mode + haute priorité
            '!bg-slate-800 !text-white',
            'w-full border border-slate-600 rounded-lg px-3.5 py-2.5',
            'text-sm font-sans cursor-pointer',
            'appearance-none',
            
            // Flèche custom plus visible (gris clair → blanc cassé)
            'bg-[image:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23e2e8f0\' stroke-width=\'2.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")]',
            'bg-no-repeat bg-[position:right_0.75rem_center] bg-[length:1rem]',
            'pr-10', // espace pour la flèche
            
            'transition-all duration-200 outline-none',
            'focus:!border-brand-primary focus:!ring-2 focus:!ring-brand-primary/30 focus:!bg-slate-800',
            
            // Erreur
            error && '!border-red-500/70 focus:!border-red-500 focus:!ring-red-500/30',
            
            className
          )}
          {...props}
        >
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              className="!bg-slate-800 !text-white hover:!bg-slate-700"
            >
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            'w-full bg-dark-surface border border-dark-border2 rounded-lg px-3.5 py-2.5',
            'text-sm text-slate-100 placeholder:text-slate-600 font-sans',
            'transition-all duration-200 outline-none resize-vertical min-h-[80px]',
            'focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20',
            error && 'border-red-500/50',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'