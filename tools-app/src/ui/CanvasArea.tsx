import { useId } from 'react'
import { useCanvasPanZoom, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../hooks/useCanvasPanZoom'

export interface CanvasAreaProps {
  children: React.ReactNode
  className?: string
  onKeyDown?: (e: React.KeyboardEvent) => void
  zoom?: number
  onZoomChange?: (z: number) => void
}

export function CanvasArea({ children, className, onKeyDown, zoom: zoomProp, onZoomChange }: CanvasAreaProps) {
  const own = useCanvasPanZoom()
  const zoom = zoomProp ?? own.zoom

  const gridId = `grid-${useId().replace(/:/g, '')}`

  const handleWheel = (e: React.WheelEvent) => {
    if (!onZoomChange) {
      own.onWheel(e)
      return
    }
    const delta = e.deltaY > 0 ? -1 : 1
    const step = e.shiftKey ? 0.02 : ZOOM_STEP
    onZoomChange(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta * step)))
  }

  return (
    <div
      ref={own.containerRef}
      className={`relative flex-1 overflow-hidden bg-background select-none ${className ?? ''}`}
      onMouseDown={own.onMouseDown}
      onMouseMove={own.onMouseMove}
      onMouseUp={own.onMouseUp}
      onMouseLeave={own.onMouseLeave}
      onWheel={handleWheel}
      onDoubleClick={() => {
        onZoomChange?.(1)
        own.onDoubleClick()
      }}
      onKeyDown={(e) => {
        own.onKeyDown(e)
        onKeyDown?.(e)
      }}
      role="application"
      aria-label="Drag to pan canvas"
      tabIndex={0}
    >
      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        <defs>
          <pattern id={gridId} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="hsl(var(--muted-foreground))" opacity="0.2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      </svg>

      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${own.pan.x}px, ${own.pan.y}px) scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}