import { useCallback, useSyncExternalStore } from 'react'
import { useArchiveCursor } from './useArchiveCursor'

// The single place cursor state is read for effect gating. Effect sites must not
// reach for isCursorActiveRef / isDragging / cursorRef directly: those three mean
// different things (spec §6) and hand-rolling the ternary at each site is exactly
// how the rule got lost three times in one session.
//
// One API, no convenience form, so a compliant file is recognisable by a single
// greppable call — which is what the structural test in Task 4 keys on.
export function useCursorGate() {
  const { isTouch, isCursorAwakeRef, cursorParkedRef } = useArchiveCursor()

  // The rect stays with the caller: every compliant site already computes it each
  // frame, so the hook supplies the cursor side and never measures anything itself.
  // A parked-but-asleep cursor is over nothing: without the awake check a sleeping
  // cursor would keep reporting true and drive effects it has been put to sleep to stop.
  const isOver = useCallback((rect) => {
    if (!rect || !isCursorAwakeRef.current) return false
    const p = cursorParkedRef.current
    return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom
  }, [cursorParkedRef, isCursorAwakeRef])

  return { isTouch, isAwake: isCursorAwakeRef, parked: cursorParkedRef, isOver }
}

// Render-path companion to `isAwake`. The ref form is right for rAF and event
// callbacks, but a component that derives JSX from it would render once and never
// again, because a ref mutation is not a state change. Use this when awake-ness
// decides what to render; keep using the ref when it only decides what a frame does.
export function useAwakeState() {
  const { isCursorAwakeRef, subscribeCursorAwake } = useArchiveCursor()
  return useSyncExternalStore(
    subscribeCursorAwake,
    () => isCursorAwakeRef.current,
    () => false,
  )
}
