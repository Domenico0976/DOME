import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../hooks/useCanvasPanZoom'

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export interface ZoomPanelProps {
  zoom: number
  onZoomChange: (z: number) => void
  className?: string
}

export function ZoomPanel({ zoom, onZoomChange, className }: ZoomPanelProps) {
  return (
    <div
      data-testid="zoom-panel"
      className={cn(
        'absolute left-3 z-10 flex min-w-[160px] items-center gap-1 rounded-[12px] border border-border bg-surface-panel px-2 py-1.5 shadow-2xl',
        className,
      )}
      style={{ bottom: 'calc(var(--soundbar-height) + 12px)' }}
      role="group"
      aria-label="Canvas zoom"
    >
      <span
        className="flex-1 select-none text-center font-mono text-xs text-muted-foreground"
        data-testid="zoom-percent"
      >
        {Math.round(zoom * 100)}%
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Zoom out"
        onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))}
      >
        <span aria-hidden className="text-sm font-medium">
          −
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Zoom in"
        onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))}
      >
        <span aria-hidden className="text-sm font-medium">
          +
        </span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-[8px] px-2 text-xs"
        aria-label="Reset zoom"
        onClick={() => onZoomChange(1)}
      >
        Reset
      </Button>
    </div>
  )
}
