import * as React from 'react'
import { cn } from '../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Input } from './input'

export interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
}

const PALETTE: string[] = [
  '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#30B0C0', '#0A84FF',
  '#5856D6', '#AF52DE', '#FF2D55', '#64768B', '#8E8E93', '#C7C7CC',
  '#FFFFFF', '#000000',
]

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([A-Fa-f0-9]{6})$/.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function normalizeHex(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('#')) {
    const rgb = hexToRgb(trimmed)
    return rgb ? rgbToHex(...rgb) : null
  }
  if (trimmed.length === 7) {
    const rgb = hexToRgb(trimmed)
    return rgb ? rgbToHex(...rgb) : null
  }
  if (trimmed.length === 4) {
    const rgb = hexToRgb(trimmed.slice(1).split('').map(c => c + c).join(''))
    return rgb ? rgbToHex(...rgb) : null
  }
  return null
}

const ColorPicker = React.forwardRef<HTMLButtonElement, ColorPickerProps>(
  ({ value, onChange, label, ariaLabel, className, disabled, ...props }, ref) => {
    const [open, setOpen] = React.useState(false)
    const [draft, setDraft] = React.useState(value)
    const inputId = React.useId()

    React.useEffect(() => {
      setDraft(value)
    }, [value])

    const commit = (next: string) => {
      const norm = normalizeHex(next)
      if (norm) {
        onChange(norm)
        setDraft(norm)
        setOpen(false)
      } else {
        setDraft(next)
      }
    }

    const valid = normalizeHex(value) !== null
    const display = valid ? value.toUpperCase() : value

    return (
      <div
        className={cn('inline-flex items-center gap-[var(--field-gap,8px)]', className)}
        {...props}
      >
        {label && (
          <label
            htmlFor={inputId}
            className="text-[12px] font-medium text-muted-foreground leading-none"
          >
            {label}
          </label>
        )}
        <div className="flex items-center gap-[var(--field-gap,8px)]">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              ref={ref}
              disabled={disabled}
              aria-label={ariaLabel ?? label ?? 'Pick color'}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={cn(
                'w-[22px] h-[22px] rounded-[var(--color-swatch-radius,4px)] border border-border-strong bg-transparent p-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                disabled && 'opacity-50 pointer-events-none',
              )}
              style={{ backgroundColor: valid ? value : 'transparent' }}
            >
              <span className="sr-only">Open color palette</span>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={6}
              className={cn(
                'w-[var(--color-picker-width,240px)] rounded-[var(--color-picker-radius,10px)] border border-border bg-popover p-3 flex flex-col gap-2',
              )}
            >
              <div className="flex items-center gap-2">
                <Input
                  id={inputId}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commit(draft)
                    if (e.key === 'Escape') {
                      setDraft(value)
                      setOpen(false)
                    }
                  }}
                  className="font-mono text-[12px] uppercase"
                  aria-label="Hex color value"
                />
                <div
                  className="w-[22px] h-[22px] rounded-[var(--color-swatch-radius,4px)] border border-border-strong shrink-0"
                  style={{ backgroundColor: valid ? value : 'transparent' }}
                  aria-hidden
                />
              </div>
              <div
                className="grid grid-cols-7 gap-1"
                role="grid"
                aria-label="Color palette"
              >
                {PALETTE.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select ${c}`}
                    onClick={() => commit(c)}
                    className={cn(
                      'w-[22px] h-[22px] rounded-[var(--color-swatch-radius,4px)] border border-border-strong transition-transform hover:scale-110',
                      value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-primary-300 ring-offset-1 ring-offset-popover',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <span
            className={cn(
              'font-mono text-[12px] tabular-nums text-muted-foreground w-[64px] text-right',
            )}
            aria-live="off"
          >
            {display}
          </span>
        </div>
      </div>
    )
  },
)
ColorPicker.displayName = 'ColorPicker'

export { ColorPicker }