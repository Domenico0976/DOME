import { cn } from '../lib/utils'

export interface ValuePillProps {
  value: number | string
  unit?: string
  decimals?: number
  className?: string
}

export function ValuePill({ value, unit = '', decimals = 2, className }: ValuePillProps) {
  const formatted =
    typeof value === 'number'
      ? value.toFixed(decimals).replace(/\.?0+$/, '')
      : String(value)

  return (
    <span
      className={cn(
        'font-mono text-[12px] tabular-nums text-muted-foreground w-[46px] text-right shrink-0',
        className,
      )}
      aria-live="off"
    >
      {formatted}
      {unit && <span className="text-muted-foreground/70">{unit}</span>}
    </span>
  )
}