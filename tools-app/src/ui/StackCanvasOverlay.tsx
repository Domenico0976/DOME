import { useRef, useState } from 'react'
import { StackVertical } from './StackVertical'

const DEFAULT_POS = { x: 12, y: 12 }

export function StackCanvasOverlay() {
  const [pos, setPos] = useState(DEFAULT_POS)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  const clampPos = (x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y }
    return {
      x: Math.max(8, Math.min(window.innerWidth - 280, x)),
      y: Math.max(8, Math.min(window.innerHeight - 200, y)),
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-40" data-testid="stack-canvas-overlay">
      <div
        className="pointer-events-auto absolute max-h-[calc(100%-24px)]"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => {
          const handle = (e.target as HTMLElement).closest('[data-panel-drag-handle]')
          if (!handle) return
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d) return
          setPos(clampPos(d.origX + e.clientX - d.startX, d.origY + e.clientY - d.startY))
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
      >
        <StackVertical onNudge={(dx, dy) => setPos((p) => clampPos(p.x + dx, p.y + dy))} />
      </div>
    </div>
  )
}
