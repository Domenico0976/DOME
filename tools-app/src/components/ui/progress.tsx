import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
  indeterminate?: boolean
  label?: string
  showValue?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, max = 100, indeterminate = false, label, showValue = false, className, ...props }, ref) => {
    const isIndeterminate = indeterminate || (value === undefined)
    const safeValue = isIndeterminate ? 0 : (value ?? 0)
    const percent = max > 0 ? Math.min(100, Math.max(0, (safeValue / max) * 100)) : 0

    return (
      <>
        <style>{`
          @keyframes progress-indeterminate {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        `}</style>
        <div
          ref={ref}
          role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={isIndeterminate ? undefined : value}
        aria-label={label}
        className={cn(
          'flex flex-col gap-[var(--field-gap,8px)] w-full',
          className,
        )}
        {...props}
      >
        {(label || showValue) && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            {label && <span>{label}</span>}
            {showValue && !isIndeterminate && (
              <span className="font-mono tabular-nums">{Math.round(percent)}%</span>
            )}
          </div>
        )}
        <div
          className={cn(
            'relative h-[var(--progress-height,6px)] w-full rounded-[var(--progress-radius,999px)] bg-[var(--progress-bg)] overflow-hidden',
          )}
        >
          {isIndeterminate ? (
            <div
              className={cn(
                'absolute top-0 left-0 h-full w-1/3 rounded-[var(--progress-radius,999px)] bg-[var(--progress-fill)]',
                'animate-progress-indeterminate',
              )}
            />
          ) : (
            <div
              className="h-full rounded-[var(--progress-radius,999px)] bg-[var(--progress-fill)] transition-[width] duration-[var(--motion-base,180ms)] ease-out"
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
      </div>
      </>
    )
  },
)
Progress.displayName = 'Progress'

export { Progress }