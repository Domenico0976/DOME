import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useProjectStore } from '../state/projectStore'
import { Slider } from '../components/ui/slider'
import { cn } from '../lib/utils'

const QUALITIES = ['low', 'med', 'high', '4k'] as const
const QUALITY_LABELS: Record<(typeof QUALITIES)[number], string> = {
  low: 'Low · 360p',
  med: 'Medium · 720p',
  high: 'High · 1080p',
  '4k': 'Ultra 4K',
}

export interface SettingsPanelProps {
  open: boolean
  onClose: () => void
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border/60 py-2 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-1 text-[12px] font-medium text-foreground"
        aria-expanded={open}
      >
        {title}
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-muted-foreground">
            <path d="m6 9 6 6 6-6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-muted-foreground">
            <path d="m18 15-6-6-6 6" />
          </svg>
        )}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step ?? 1} onValueChange={(v) => onChange(v[0])} />
    </div>
  )
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const quality = useProjectStore((s) => s.canvas.quality)
  const setQuality = useProjectStore((s) => s.setQuality)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])

  if (!open) return null

  const qualityIndex = QUALITIES.indexOf(quality)

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed top-14 right-4 z-50 w-[240px] rounded-lg border border-border bg-popover p-3 shadow-lg',
      )}
      data-testid="settings-panel"
      role="dialog"
      aria-label="Settings"
      tabIndex={-1}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold">Settings</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="grid h-5 w-5 place-items-center rounded-md hover:bg-surface-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <Section title="Preview">
        <SliderRow
          label="Quality"
          value={qualityIndex}
          min={0}
          max={3}
          step={1}
          format={(v) => QUALITY_LABELS[QUALITIES[v] as keyof typeof QUALITY_LABELS]}
          onChange={(v) => setQuality(QUALITIES[v])}
        />
      </Section>
    </div>
  )
}