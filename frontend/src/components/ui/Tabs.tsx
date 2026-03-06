import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

const TabsContext = createContext<{
  active: string
  setActive: (v: string) => void
}>({ active: '', setActive: () => {} })

interface TabsProps {
  defaultValue: string
  children: React.ReactNode
  className?: string
  onChange?: (v: string) => void
}

export function Tabs({ defaultValue, children, className, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultValue)

  const handleSet = (v: string) => {
    setActive(v)
    onChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ active, setActive: handleSet }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex gap-1 bg-dark-surface border border-dark-border rounded-lg p-1 mb-5',
        className
      )}
    >
      {children}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { active, setActive } = useContext(TabsContext)
  const isActive = active === value

  return (
    <button
      onClick={() => setActive(value)}
      className={cn(
        'flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 text-center',
        isActive
          ? 'bg-dark-card text-slate-100 shadow-sm'
          : 'text-slate-400 hover:text-slate-200 hover:bg-dark-card/50',
        className
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const { active } = useContext(TabsContext)
  if (active !== value) return null

  return (
    <div className={cn('animate-fadeIn', className)}>
      {children}
    </div>
  )
}
