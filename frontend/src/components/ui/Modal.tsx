import React, { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'bg-dark-card border border-dark-border2 rounded-2xl p-7 w-full shadow-lg',
          'max-h-[90vh] overflow-y-auto',
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-dark-card2 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-dark-border transition-all"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
