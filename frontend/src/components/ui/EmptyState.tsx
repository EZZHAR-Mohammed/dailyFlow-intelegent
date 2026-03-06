import React from 'react'
import { Button } from './Button'

interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
      <div className="text-4xl opacity-40">{icon}</div>
      <div className="text-sm text-slate-300">{title}</div>
      {description && <div className="text-xs text-slate-500 max-w-xs">{description}</div>}
      {action && (
        <Button variant="primary" size="sm" className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <div
      className={`rounded-full border-2 border-slate-700 border-t-brand-primary animate-spin ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={32} />
    </div>
  )
}
