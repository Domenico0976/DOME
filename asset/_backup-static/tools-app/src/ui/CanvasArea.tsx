import { useId } from 'react'
import { useCanvasPanZoom } from '../hooks/useCanvasPanZoom'

export interface CanvasAreaProps {
  children: React.ReactNode
  className?: string
}

export function CanvasArea({ children, className }: CanvasAreaProps) {
  const {
    pan,
    zoom,
    containerRef,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onWheel,
    onDoubleClick,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useCanvasPanZoom()

  const gridId = `grid-${useId().replace(/:/g, '')}`

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden bg-background select-none ${className ?? ''}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
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
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {children}
      </div>

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-md">
        <button
          type="button"
          onClick={zoomOut}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-sm font-medium text-foreground hover:bg-muted"
          aria-label="Zoom out"
        >
          -
        </button>
        <span className="flex h-8 w-12 items-center justify-center select-none font-mono text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-sm font-medium text-foreground hover:bg-muted"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-xs font-medium text-foreground hover:bg-muted"
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
