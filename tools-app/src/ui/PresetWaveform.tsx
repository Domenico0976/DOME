import { useRef } from 'react'
import { cn } from '../lib/utils'
import type { AudioBinding } from '../core/types'

interface PresetWaveformProps {
  presetId: string
  param: string
  source: AudioBinding['source']
  amount: number
  registerCanvas: (id: string, el: HTMLCanvasElement | null) => void
  onAmountChange: (amount: number) => void
}

const clampAmount = (v: number) => Math.max(0, Math.min(2, Math.round(v / 0.05) * 0.05))

export function PresetWaveform({ presetId, param, source, amount, registerCanvas, onAmountChange }: PresetWaveformProps) {
  const dragRef = useRef<{ startX: number; startAmount: number; width: number } | null>(null)

  return (
    <canvas
      ref={(el) => registerCanvas(presetId, el)}
      role="slider"
      tabIndex={0}
      aria-label={`${param} level from ${source}, drag to set amount`}
      aria-valuemin={0}
      aria-valuemax={200}
      aria-valuenow={Math.round(amount * 100)}
      aria-valuetext={`${Math.round(amount * 100)} percent`}
      title={`${source} live — drag to set amount`}
      className={cn(
        'h-7 w-full cursor-ew-resize rounded bg-surface-2/60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      onPointerDown={(e) => {
        const el = e.currentTarget as HTMLCanvasElement
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* jsdom / touch without capture support */
        }
        dragRef.current = { startX: e.clientX, startAmount: amount, width: Math.max(1, el.clientWidth) }
      }}
      onPointerMove={(e) => {
        const d = dragRef.current
        if (!d) return
        onAmountChange(clampAmount(d.startAmount + ((e.clientX - d.startX) / d.width) * 2))
      }}
      onPointerUp={() => {
        dragRef.current = null
      }}
      onPointerCancel={() => {
        dragRef.current = null
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.25 : 0.05
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault()
          onAmountChange(clampAmount(amount + step))
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault()
          onAmountChange(clampAmount(amount - step))
        }
      }}
    />
  )
}
