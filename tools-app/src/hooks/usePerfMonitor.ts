import { useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'

export type PerfLevel = 'ok' | 'degraded'

export interface PerfSample {
  level: PerfLevel
  reason: string | null
}

export interface UsePerfMonitorOptions {
  /** Frame-time budget in ms before we consider the frame over budget. */
  thresholdMs?: number
  /** Consecutive over-budget frames required to trip into degraded. */
  sustainedMs?: number
  /** Override the global `requestAnimationFrame` — useful in tests. */
  requestAnimationFrame?: (cb: FrameRequestCallback) => number
  /** Override the clock — useful in tests. */
  now?: () => number
  /** When true the hook no-ops (e.g. document hidden). */
  enabled?: boolean
}

interface PerfState {
  level: PerfLevel
  reason: string | null
}

/**
 * usePerfMonitor — lightweight frame-time monitor.
 *
 * - Measures delta between rAF callbacks using an EMA-smoothed frame time.
 * - Trips into `degraded` only after `sustainedMs` of sustained over-budget frames.
 * - Recovers to `ok` after the same sustained window of in-budget frames.
 * - Writes to the store ONLY on level change (never on every frame).
 * - No-ops when `enabled` is false or the document is hidden.
 * - Fully unit-testable: inject `requestAnimationFrame` and `now`.
 */
export function usePerfMonitor(options: UsePerfMonitorOptions = {}) {
  const {
    thresholdMs = 24,
    sustainedMs = 2000,
    requestAnimationFrame: rafImpl,
    now: nowImpl,
    enabled = true,
  } = options

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const emaRef = useRef<number | null>(null)
  const overSinceRef = useRef<number | null>(null)
  const underSinceRef = useRef<number | null>(null)
  const levelRef = useRef<PerfState>({ level: 'ok', reason: null })
  const lastSampleRef = useRef<number | null>(null)
  const setPerf = useProjectStore((s) => s.setPerf)

  const raf = rafImpl ?? (typeof window !== 'undefined' ? window.requestAnimationFrame.bind(window) : null)
  const clock = nowImpl ?? (typeof performance !== 'undefined' ? performance.now.bind(performance) : Date.now)

  const commit = (next: PerfState) => {
    if (next.level === levelRef.current.level) return
    levelRef.current = next
    setPerf({ level: next.level, reason: next.reason })
  }

  useEffect(() => {
    if (!enabled || !raf) return
    // Guard against re-entry: if a loop is already running, leave it alone so
    // re-renders (e.g. from a store update) don't reset the monitor state.
    if (rafRef.current !== null) return

    const loop = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        rafRef.current = null
        return
      }
      const now = clock()
      const frameTime = lastTimeRef.current === null ? 0 : now - lastTimeRef.current
      lastTimeRef.current = now

      // EMA of frame time (alpha ~0.25).
      const alpha = 0.25
      emaRef.current = emaRef.current === null ? frameTime : emaRef.current + alpha * (frameTime - emaRef.current)

      if (lastSampleRef.current === null || now - lastSampleRef.current >= 0) {
        lastSampleRef.current = now
        const over = emaRef.current > thresholdMs

        if (over) {
          underSinceRef.current = null
          if (overSinceRef.current === null) {
            overSinceRef.current = now
          }
          if (now - overSinceRef.current >= sustainedMs) {
            commit({
              level: 'degraded',
              reason: `Frame time ${Math.round(emaRef.current)}ms over budget — preview quality reduced`,
            })
          }
        } else {
          overSinceRef.current = null
          if (underSinceRef.current === null) {
            underSinceRef.current = now
          }
          if (now - underSinceRef.current >= sustainedMs) {
            commit({ level: 'ok', reason: null })
          }
        }
      }

      rafRef.current = raf(loop)
    }

    rafRef.current = raf(loop)
    return () => {
      if (rafRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = null
    }
  }, [enabled, raf, clock, thresholdMs, sustainedMs, setPerf])

  return { level: 'ok' as const, reason: null }
}