import { useEffect, useRef } from 'react'

type FrameCallback = (timeSec: number, dt: number) => void

export function useEngineFrame(callback: FrameCallback): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (rafIdRef.current !== null) return

    let lastTimeSec: number | null = null
    const loop = (timeMs: number): void => {
      const timeSec = timeMs / 1000
      const dt = lastTimeSec === null ? 0 : Math.max(0, Math.min(0.1, timeSec - lastTimeSec))
      lastTimeSec = timeSec
      callbackRef.current(timeSec, dt)
      rafIdRef.current = requestAnimationFrame(loop)
    }

    rafIdRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])
}
