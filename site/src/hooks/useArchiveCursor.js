import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { useIsMobile } from './useIsMobile'
import { useIsTouch } from './useIsTouch'

const ArchiveCursorContext = createContext(null)

// ─── RAF throttling ──────────────────────────────────────────────────────────
let lastFrameTime = -Infinity

/**
 * Returns a throttled version of callback that only fires when at least
 * intervalMs ms have elapsed since the last invocation (default 16ms ≈ 60fps).
 */
export function throttleRAF(callback, intervalMs = 16) {
  return (timestamp) => {
    if (timestamp - lastFrameTime >= intervalMs) {
      lastFrameTime = timestamp
      callback(timestamp)
    }
  }
}

/** Resets lastFrameTime so the next call is always allowed (useful for tests). */
export function resetRAFThrottle() {
  lastFrameTime = -Infinity
}

export function ArchiveCursorProvider({ children }) {
  const isMobile = useIsMobile()
  // isMobile = LAYOUT (720px). isTouch = INPUT (any-pointer: coarse). A tablet
  // is isMobile:false but isTouch:true, and needs the touch cursor plus
  // drag-gated effects. Do not collapse these back into one flag.
  const isTouch = useIsTouch()
  const [canvasState, setCanvasState] = useState({ open: false, image: null })
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const cursorRef = useRef({ x: 0, y: 0 })
  const isCursorActiveRef = useRef(false)
  const dragTimerRef = useRef(null)

  // ── Parked cursor (spec §5.1) ──────────────────────────────────────────────
  // Activation and influence are separate. `isCursorActiveRef` means "a drag is
  // happening right now" and is cleared on pointerup, so it cannot express a
  // cursor that is parked and still steering an effect. These two refs can.
  const isCursorAwakeRef = useRef(false)
  const cursorParkedRef = useRef({ x: 0, y: 0 })
  const sleepTimerRef = useRef(null)
  // Declared default, not a measured value (spec §11.2). Tunable after it runs.
  const CURSOR_SLEEP_MS = 4000

  // Render-path subscribers. `isCursorAwakeRef` is a ref on purpose — rAF and
  // event callbacks must read it without re-rendering — but a component that
  // RENDERS from it would never observe a change. This is the bridge for that case;
  // useSyncExternalStore in useCursorGate consumes it. rAF consumers keep the ref.
  const awakeListenersRef = useRef(new Set())
  const subscribeCursorAwake = useCallback((cb) => {
    awakeListenersRef.current.add(cb)
    return () => { awakeListenersRef.current.delete(cb) }
  }, [])

  // Single writer for the awake flag, so no path can change it without notifying.
  const setAwake = useCallback((value) => {
    if (isCursorAwakeRef.current === value) return
    isCursorAwakeRef.current = value
    for (const cb of awakeListenersRef.current) cb()
  }, [])

  // Drag-tap disambiguation timer

  const openCanvas = useCallback((image, effectType = 'archive-wind', effectOpts = null) => {
    setCanvasState({ open: true, image, effectType, effectOpts })
  }, [])

  const closeCanvas = useCallback(() => {
    setCanvasState({ open: false, image: null, effectType: 'archive-wind', effectOpts: null })
  }, [])

  const updateCursor = useCallback((x, y) => {
    cursorRef.current = { x, y }
  }, [])

  // Sole writer method — all components should use this (or updateCursor) to write
  // cursor position. Direct mutation of cursorRef.current elsewhere is discouraged.
  const setCursor = useCallback((x, y) => {
    cursorRef.current = { x, y }
  }, [])

  const startDragTimer = useCallback(() => {
    dragTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true
      setIsDragging(true)
    }, 100)
  }, [])

  const clearDragTimer = useCallback(() => {
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current)
      dragTimerRef.current = null
    }
  }, [])

  const resetDragState = useCallback(() => {
    clearDragTimer()
    isDraggingRef.current = false
    isCursorActiveRef.current = false
    setIsDragging(false)
  }, [clearDragTimer])

  // ── Viewport latch (spec §1) ─────────────────────────────────────────────────
  // True only when the canvas was closed because the archives section left the
  // viewport. Distinct from ordinary hover/tap state and deliberately sticky: it
  // survives the section scrolling back into view, so the only way out is a fresh
  // interaction on a project. A ref, not state — rAF and event handlers read it
  // without forcing a re-render, matching how isAwake already works here.
  const latchedClosed = useRef(false)
  // Which row was open when the latch was set. The spec requires a fresh interaction
  // to mean a *different* row, so re-entering the same row after scrolling away and
  // back must NOT clear the latch.
  const latchedRowRef = useRef(null)

  const setLatchedClosed = useCallback((rowIndex) => {
    latchedClosed.current = true
    latchedRowRef.current = rowIndex ?? null
  }, [])
  const clearLatchedClosed = useCallback(() => {
    latchedClosed.current = false
    latchedRowRef.current = null
  }, [])
  // True when entering `rowIndex` counts as a fresh interaction: any tap on mobile,
  // and on desktop only a row other than the one the latch closed on.
  const isFreshInteraction = useCallback((rowIndex) => {
    if (!latchedClosed.current) return true
    if (!isMobile) return rowIndex !== latchedRowRef.current
    return true
  }, [isMobile])

  // Wakes the cursor and (re)starts the idle countdown. Every cursor movement goes
  // through here, so a deliberate placement is never cut off mid-read by the timeout.
  const wakeCursor = useCallback(() => {
    setAwake(true)
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    sleepTimerRef.current = setTimeout(() => {
      setAwake(false)
      sleepTimerRef.current = null
    }, CURSOR_SLEEP_MS)
  }, [setAwake])

  const activateCursor = useCallback(() => {
    isDraggingRef.current = true
    isCursorActiveRef.current = true
    wakeCursor()
    setIsDragging(true)
  }, [wakeCursor])

  const parkCursor = useCallback((x, y) => {
    cursorParkedRef.current = { x, y }
    wakeCursor()
  }, [wakeCursor])

  const sleepCursor = useCallback(() => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current)
      sleepTimerRef.current = null
    }
    setAwake(false)
  }, [setAwake])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragTimerRef.current) {
        clearTimeout(dragTimerRef.current)
      }
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    }
  }, [])

  // Kill any stale open canvas when leaving touch mode — prevents the portal
  // lingering in document.body on a device that cannot drive it. isTouch, not
  // isMobile: the viewer is a touch surface, so a wide tablet must keep it.
  useEffect(() => {
    if (!isTouch && canvasState.open) {
      setCanvasState({ open: false, image: null, effectType: 'archive-wind', effectOpts: null })
    }
  }, [isTouch, canvasState.open])

  // Reset drag state whenever the breakpoint flips. The 100ms disambiguation
  // timer and the two refs survive the flip otherwise, leaving isDraggingRef
  // stuck true in desktop if the resize landed inside that window.
  useEffect(() => {
    clearDragTimer()
    resetDragState()
  }, [isMobile])

  // Same for the input mode: a mouse docked onto a tablet (or the reverse) flips
  // isTouch at runtime, and a held finger must not carry over as a "drag".
  useEffect(() => {
    clearDragTimer()
    resetDragState()
  }, [isTouch])

  return React.createElement(ArchiveCursorContext.Provider, { value: {
    isMobile,
    isTouch,
    canvasState,
    cursorRef,
    isCursorActiveRef,
    isCursorAwakeRef,
    cursorParkedRef,
    parkCursor,
    sleepCursor,
    subscribeCursorAwake,
    updateCursor,
    setCursor,
    activateCursor,
    openCanvas,
    closeCanvas,
    isDragging,
    isDraggingRef,
    startDragTimer,
    clearDragTimer,
    resetDragState,
    latchedClosed,
    latchedRowRef,
    setLatchedClosed,
    clearLatchedClosed,
    isFreshInteraction,
  } }, children)
}

export function useArchiveCursor() {
  const ctx = useContext(ArchiveCursorContext)
  if (!ctx) throw new Error('useArchiveCursor must be used within ArchiveCursorProvider')
  return ctx
}
