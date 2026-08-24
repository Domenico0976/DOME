import { forwardRef, useImperativeHandle, useRef } from 'react'
import { resolveCaps } from './caps'
import { exportCanvasAsPng } from './export'

export interface PreviewFrameInfo {
  frame: number
  timeSec: number
  dt: number
}

export interface RenderSurfaceHandle {
  frame(timeSec: number): void
  exportPng(): Promise<string>
}

interface RenderSurfaceProps {
  drawFrame: (ctx: CanvasRenderingContext2D, info: PreviewFrameInfo) => void
}

export const RenderSurface = forwardRef<RenderSurfaceHandle, RenderSurfaceProps>(
  function RenderSurface({ drawFrame }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const wrapRef = useRef<HTMLDivElement>(null)
    const capsRef = useRef(resolveCaps(window.matchMedia('(pointer: coarse)').matches))
    const sizeRef = useRef({ w: 0, h: 0 })
    const lastTimeRef = useRef<number | null>(null)
    const lastDrawnRef = useRef(-Infinity)
    const frameCountRef = useRef(0)

    const resizeIfNeeded = (): void => {
      const canvas = canvasRef.current
      const wrap = wrapRef.current
      if (canvas === null || wrap === null) return
      const caps = capsRef.current
      const devicePixelRatio = window.devicePixelRatio || 1
      const dpr = Math.min(devicePixelRatio, caps.dprCap)
      const cssWidth = Math.min(wrap.clientWidth, caps.maxWidth)
      const width = Math.max(1, Math.floor(cssWidth * dpr))
      const height = Math.max(1, Math.floor(wrap.clientHeight * dpr))
      if (width !== sizeRef.current.w || height !== sizeRef.current.h) {
        canvas.width = width
        canvas.height = height
        sizeRef.current = { w: width, h: height }
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        frame(timeSec: number): void {
          const canvas = canvasRef.current
          if (canvas === null) return
          resizeIfNeeded()
          const minInterval = 1 / capsRef.current.maxFps
          if (lastTimeRef.current !== null && timeSec - lastDrawnRef.current < minInterval) {
            lastTimeRef.current = timeSec
            return
          }
          const dt =
            lastTimeRef.current === null
              ? 0
              : Math.max(0, Math.min(0.1, timeSec - lastTimeRef.current))
          frameCountRef.current += 1
          const ctx = canvas.getContext('2d')
          if (ctx === null) return
          drawFrame(ctx, { frame: frameCountRef.current, timeSec, dt })
          lastTimeRef.current = timeSec
          lastDrawnRef.current = timeSec
        },

        exportPng(): Promise<string> {
          const canvas = canvasRef.current
          if (canvas === null) return Promise.reject(new Error('Preview not mounted'))
          return exportCanvasAsPng(canvas)
        },
      }),
      [drawFrame],
    )

    return (
      <div className="render-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
    )
  },
)
