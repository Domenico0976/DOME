import { useState, useRef, useEffect, useCallback } from 'react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { X, Grip } from 'lucide-react'
import { NodeOptions } from './NodeOptions'
import { cn } from '../lib/utils'
import type { StackItem } from '../core/types'
import { useProjectStore } from '../state/projectStore'
import { resolveTool } from '../core/registry'

gsap.registerPlugin(Draggable)

interface FloatingPanelProps {
  item: StackItem | null
  onClose: () => void
}

// ParamsPanel/Floating spec (.pen `TCY8O`): 290×496.
const DEFAULT_WIDTH = 290
const DEFAULT_HEIGHT = 496
const SNAP_THRESHOLD = 100
const MIN_SIZE = 200
const VIEWPORT_CLAMP_MARGIN = 12

export function FloatingPanel({ item, onClose }: FloatingPanelProps) {
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [isSnapped, setIsSnapped] = useState(false)
  const [snapSide, setSnapSide] = useState<'left' | 'right' | null>(null)
  const [snapPreview, setSnapPreview] = useState<'left' | 'right' | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const draggableRef = useRef<Draggable | null>(null)
  const posRef = useRef({ x: 16, y: 68 })
  const selectedUid = useProjectStore((s) => s.selectedUid)

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

  // Clamp position to viewport margins (12px)
  const clampPosition = useCallback((x: number, y: number, width: number, height: number): { x: number, y: number } => {
    const maxX = window.innerWidth - width - VIEWPORT_CLAMP_MARGIN
    const maxY = window.innerHeight - height - VIEWPORT_CLAMP_MARGIN
    return {
      x: Math.max(VIEWPORT_CLAMP_MARGIN, Math.min(x, maxX)),
      y: Math.max(VIEWPORT_CLAMP_MARGIN, Math.min(y, maxY)),
    }
  }, [])

  // Clamp-only on selection change: full node-bbox avoidance needs the node screen rect, unavailable here.
  useEffect(() => {
    if (isSnapped || !panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const clamped = clampPosition(posRef.current.x, posRef.current.y, rect.width, rect.height)
    posRef.current = clamped
    gsap.set(panelRef.current, { x: clamped.x, y: clamped.y })
  }, [selectedUid, isSnapped, clampPosition])

  // ESC close handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  // Focus return: record the opener on mount, restore focus on unmount.
  const previousFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    return () => {
      previousFocusRef.current?.focus?.()
    }
  }, [])

  // Keyboard resize handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!panelRef.current) return
    const { width, height } = size
    let newWidth = width
    let newHeight = height
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        newHeight = Math.max(MIN_SIZE, height - 8)
        break
      case 'ArrowDown':
        e.preventDefault()
        newHeight = height + 8
        break
      case 'ArrowLeft':
        e.preventDefault()
        newWidth = Math.max(MIN_SIZE, width - 8)
        break
      case 'ArrowRight':
        e.preventDefault()
        newWidth = width + 8
        break
      default:
        return
    }
    
    // Apply viewport clamp to new size
    const clampedSize = clampPosition(posRef.current.x, posRef.current.y, newWidth, newHeight)
    setSize({ width: newWidth, height: newHeight })
    posRef.current = clampedSize
    gsap.to(panelRef.current, { x: clampedSize.x, y: clampedSize.y, duration: 0.1 })
  }, [size, clampPosition])

  const stack = useProjectStore((s) => s.stack)

  if (!item) return null

  // Dynamic header title — spec §2: `{toolLabel} · #{index}` with ellipsis + tooltip.
  // Index 0 = front (zero-based, matching Stack/FloatingStack #N badges).
  const index = stack.findIndex((i) => i.uid === item.uid)
  const def = resolveTool(item.toolId, item.toolVersion)
  const title = `${def?.label ?? 'Node'} · #${index}`

// Apply viewport clamp on mount and when size changes to ensure panel stays within 12px margins

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
          'flex flex-col rounded-[12px] border border-border bg-surface-panel shadow-2xl',
          isSnapped ? 'relative' : 'fixed z-50',
        )}
        data-testid="floating-panel"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Header */}
        <div
          ref={headerRef}
          className="flex h-10 items-center justify-between border-b border-border px-3 shrink-0 select-none cursor-move"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Grip className="h-4 w-4 text-muted-foreground shrink-0" />
            <span
              className="text-[13px] font-medium truncate"
              title={title}
            >
              {title}
            </span>
          </div>
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
