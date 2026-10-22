import { useState, useCallback, useRef } from 'react'

export interface PanState {
  x: number
  y: number
}

export interface UseCanvasPanZoomResult {
  pan: PanState
  zoom: number
  setZoom: React.Dispatch<React.SetStateAction<number>>
  containerRef: React.RefObject<HTMLDivElement>
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onWheel: (e: React.WheelEvent) => void
  onDoubleClick: () => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 4.0
export const ZOOM_STEP = 0.1
const FINE_ZOOM_STEP = 0.02

export function useCanvasPanZoom(): UseCanvasPanZoomResult {
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState<number>(1)
  const dragging = useRef(false)
  const lastPos = useRef<PanState>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const onMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  const onMouseLeave = useCallback(() => {
    dragging.current = false
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -1 : 1
    const step = e.shiftKey ? FINE_ZOOM_STEP : ZOOM_STEP
    setZoom((prev) => {
      const next = prev + delta * step
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    })
  }, [])

  const onDoubleClick = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP))
  }, [])

  const resetZoom = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 32 : 8
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        setPan((prev) => ({ x: prev.x + step, y: prev.y }))
        break
      case 'ArrowRight':
        e.preventDefault()
        setPan((prev) => ({ x: prev.x - step, y: prev.y }))
        break
      case 'ArrowUp':
        e.preventDefault()
        setPan((prev) => ({ x: prev.x, y: prev.y - step }))
        break
      case 'ArrowDown':
        e.preventDefault()
        setPan((prev) => ({ x: prev.x, y: prev.y + step }))
        break
    }
  }, [])

  return {
    pan,
    zoom,
    setZoom,
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
    onKeyDown,
  }
}
