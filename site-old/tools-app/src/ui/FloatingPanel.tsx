import { useState, useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { X } from 'lucide-react'
import { NodeOptions } from './NodeOptions'
import { cn } from '../lib/utils'
import type { StackItem } from '../core/types'

gsap.registerPlugin(Draggable)

interface FloatingPanelProps {
  item: StackItem | null
  onClose: () => void
}

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 500
const SNAP_THRESHOLD = 100
const MIN_SIZE = 200

export function FloatingPanel({ item, onClose }: FloatingPanelProps) {
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isSnapped, setIsSnapped] = useState(false)
  const [snapSide, setSnapSide] = useState<'left' | 'right' | null>(null)
  const [snapPreview, setSnapPreview] = useState<'left' | 'right' | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const posRef = useRef({ x: 100, y: 100 })

  // Create Draggable instance once on mount
  useEffect(() => {
    if (!panelRef.current || !headerRef.current) return

    const d = Draggable.create(panelRef.current, {
      type: 'x,y',
      trigger: headerRef.current,
      onDrag: () => {
        const el = panelRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        if (rect.left < SNAP_THRESHOLD) {
          setSnapPreview('left')
        } else if (rect.left > window.innerWidth - rect.width - SNAP_THRESHOLD) {
          setSnapPreview('right')
        } else {
          setSnapPreview(null)
        }
      },
      onDragEnd: () => {
        const current = draggableRef.current
        const el = panelRef.current
        if (!current || !el) return

        const rect = el.getBoundingClientRect()
        if (rect.left < SNAP_THRESHOLD) {
          setIsSnapped(true)
          setSnapSide('left')
          setSnapPreview(null)
          posRef.current = { x: 0, y: 0 }
        } else if (rect.left > window.innerWidth - rect.width - SNAP_THRESHOLD) {
          setIsSnapped(true)
          setSnapSide('right')
          setSnapPreview(null)
          posRef.current = { x: 0, y: 0 }
        } else {
          posRef.current = { x: current.x, y: current.y }
          setSnapPreview(null)
        }
      },
    })[0]

    draggableRef.current = d

    return () => {
      d.kill()
      draggableRef.current = null
    }
  }, [])

  // Sync Draggable enabled state and position with snapped state
  useEffect(() => {
    const el = panelRef.current
    const d = draggableRef.current
    if (!el || !d) return

    if (isSnapped) {
      d.disable()
      gsap.set(el, { x: 0, y: 0 })
    } else {
      gsap.set(el, { x: posRef.current.x, y: posRef.current.y })
      d.enable()
    }
  }, [isSnapped])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startY = e.clientY
      const startWidth = size.width
      const startHeight = size.height

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newWidth = Math.max(MIN_SIZE, startWidth + moveEvent.clientX - startX)
        const newHeight = Math.max(MIN_SIZE, startHeight + moveEvent.clientY - startY)
        setSize({ width: newWidth, height: newHeight })
      }

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [size],
  )

  const handleHeaderMouseDown = useCallback(() => {
    if (!isSnapped) return
    if (snapSide === 'left') {
      posRef.current = { x: 0, y: 0 }
    } else if (snapSide === 'right') {
      posRef.current = {
        x: typeof window !== 'undefined' ? window.innerWidth - size.width : 0,
        y: 0,
      }
    }
    setIsSnapped(false)
    setSnapSide(null)
  }, [isSnapped, snapSide, size.width])

  if (!item) return null

  return (
    <>
      {/* Snap preview overlays */}
      {snapPreview === 'left' && (
        <div
          className="pointer-events-none fixed left-0 top-0 bottom-0 w-80 bg-gray-500/30 z-40"
          data-testid="snap-preview-left"
        />
      )}
      {snapPreview === 'right' && (
        <div
          className="pointer-events-none fixed right-0 top-0 bottom-0 w-80 bg-gray-500/30 z-40"
          data-testid="snap-preview-right"
        />
      )}

      <div
        ref={panelRef}
        style={{ width: size.width, height: size.height }}
        className={cn(
          'flex flex-col rounded-xl border border-border bg-surface shadow-2xl',
          isSnapped ? 'relative' : 'fixed',
        )}
        data-testid="floating-panel"
      >
        {/* Header */}
        <div
          ref={headerRef}
          className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0 select-none cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <span className="text-[13px] font-semibold">Node Options</span>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded-md hover:bg-surface-2 transition-colors"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <NodeOptions item={item} />
        </div>

        {/* Resize handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
          aria-label="Resize panel"
          role="button"
          tabIndex={0}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
            <path d="M8 16 L16 8 L16 16 Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      </div>
    </>
  )
}
