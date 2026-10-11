import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  ariaLabel?: string
}

function clamp(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.min(Math.max(v, min), max)
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ value, onChange, min = -Infinity, max = Infinity, step = 1, label, ariaLabel, className, disabled, ...props }, ref) => {
    const inputId = React.useId()
    const labelId = label ? `ni-label-${inputId}` : undefined

    const commit = (raw: string) => {
      const n = parseFloat(raw)
      if (Number.isNaN(n)) return
      onChange(clamp(n, min, max))
    }

    const stepBy = (dir: 1 | -1) => {
      const next = clamp(value + dir * step, min, max)
      onChange(next)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      commit(e.target.value)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        stepBy(1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        stepBy(-1)
      } else if (e.key === 'Enter') {
        ;(e.target as HTMLInputElement).blur()
      }
    }

    return (
      <div
        className={cn(
          'inline-flex items-stretch h-8 w-[72px] rounded-md border border-border bg-surface-2 overflow-hidden',
          disabled && 'opacity-50 pointer-events-none',
          className,
        )}
      >
        <label
          id={labelId}
          className="sr-only"
          htmlFor={inputId}
        >
          {ariaLabel ?? label ?? 'Number input'}
        </label>
        <input
          id={inputId}
          ref={ref}
          type="number"
          inputMode="numeric"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={ariaLabel ?? label ?? 'Number input'}
          aria-labelledby={labelId}
          disabled={disabled}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 min-w-0 h-full bg-transparent text-right font-mono text-[13px] tabular-nums text-foreground px-2 outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
          {...props}
        />
        <div className="flex flex-col w-[28px]">
          <button
            type="button"
            aria-label="Increase value"
            disabled={disabled}
            onClick={() => stepBy(1)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepBy(1) } }}
            className="flex items-center justify-center h-1/2 w-full text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed"
          >
            <Plus className="w-[18px] h-[18px] shrink-0" />
          </button>
          <button
            type="button"
            aria-label="Decrease value"
            disabled={disabled}
            onClick={() => stepBy(-1)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stepBy(-1) } }}
            className="flex items-center justify-center h-1/2 w-full text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-not-allowed"
          >
            <Minus className="w-[18px] h-[18px] shrink-0" />
          </button>
        </div>
      </div>
    )
  }
)
NumberInput.displayName = 'NumberInput'

export { NumberInput }