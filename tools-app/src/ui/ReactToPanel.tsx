import { useCallback } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import { Button } from '../components/ui/button'
import { Slider } from '../components/ui/slider'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'
import type { AudioBinding } from '../core/types'

const DRIVERS: Array<AudioBinding['source']> = ['bass', 'mid', 'treble', 'level', 'spectrum', 'bpm']

export interface ReactToPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: AudioBinding['source']
  amount: number
  rangeMin: number
  rangeMax: number
  rangeExplicit: boolean
  onChangeSource: (s: AudioBinding['source']) => void
  onChangeAmount: (v: number) => void
  onChangeRange: (min: number, max: number) => void
  triggerLabel?: string
  triggerClassName?: string
  param?: string
}

/**
 * ReactToPanel — self-contained Popover styled like the modular panel
 * (border, panel bg var, rounded, header row with title + X close).
 * Content per frame structure: 1 select row (source driver) + 2 slider rows
 * (sensitivity amount 0–2, value range min/max). The literal "React To Panel"
 * text is shown in the header + subtitle so it is visible while controls exist.
 */
export function ReactToPanel({
  open,
  onOpenChange,
  source,
  amount,
  rangeMin,
  rangeMax,
  rangeExplicit,
  onChangeSource,
  onChangeAmount,
  onChangeRange,
  triggerLabel,
  triggerClassName,
  param,
}: ReactToPanelProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-7 shrink-0 px-2 text-[11px]', triggerClassName)}
          aria-label={`React to settings for ${triggerLabel ?? source}`}
        >
          {triggerLabel ?? source}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        className={cn('w-[280px] p-0', 'border border-border rounded-md shadow-xl')}
        style={{
          background: 'var(--audio-panel-bg)',
          borderColor: 'var(--audio-panel-border)',
        }}
      >
        <div className="flex flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">React To Panel</span>
              <span className="truncate text-[10px] text-muted-foreground">Audio-reactive modulation</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Close React To Panel"
              onClick={close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-3 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">React to</span>
              <select
                aria-label="Audio driver"
                value={source}
                onChange={(e) => onChangeSource(e.target.value as AudioBinding['source'])}
                className="h-7 w-full rounded-md border border-border bg-surface-2 px-2 text-[12px] text-foreground"
              >
                {DRIVERS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Sensitivity</span>
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-live="polite">
                  {Math.round(amount * 100)}%
                </span>
              </div>
              <Slider
                aria-label={param ? `Sensitivity for ${param}` : 'Sensitivity'}
                min={0}
                max={2}
                step={0.05}
                value={[amount]}
                onValueChange={([v]) => onChangeAmount(v)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Value range</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {rangeExplicit ? `${rangeMin}–${rangeMax}` : 'param min/max'}
                </span>
              </div>
              <Slider
                aria-label="Value range min"
                min={-2}
                max={2}
                step={0.05}
                value={[rangeMin]}
                onValueChange={([v]) => onChangeRange(v, rangeMax)}
              />
              <Slider
                aria-label="Value range max"
                min={-2}
                max={2}
                step={0.05}
                value={[rangeMax]}
                onValueChange={([v]) => onChangeRange(rangeMin, v)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}