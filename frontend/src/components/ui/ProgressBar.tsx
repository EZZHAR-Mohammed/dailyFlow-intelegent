import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  color?: string
  className?: string
  showLabel?: boolean
  height?: 'xs' | 'sm' | 'md'
}

export function ProgressBar({
  value,
  color,
  className,
  showLabel = false,
  height = 'sm',
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  const heights = { xs: 'h-1', sm: 'h-1.5', md: 'h-2' }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 bg-dark-border rounded-full overflow-hidden', heights[height])}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${clampedValue}%`, background: color || '#6366F1' }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-slate-400 min-w-[36px] text-right">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  )
}

interface ScoreRingProps {
  value: number // 0-100
  color: string
  size?: number
  strokeWidth?: number
}

export function ScoreRing({ value, color, size = 120, strokeWidth = 8 }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="var(--tw-ring-color, #1E293B)"
        strokeWidth={strokeWidth}
        style={{ stroke: '#1E293B' }}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
      />
    </svg>
  )
}
