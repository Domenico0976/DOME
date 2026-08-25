import { useEffect, useRef } from 'react'
import { useProjectStore } from '../state/projectStore'
import { evaluateStack } from '../core/stackEngine'
import { useAudio } from '../audio/useAudio'

const RATIO = { '1:1': 1, '3:4': 3 / 4, '9:16': 9 / 16, '4:3': 4 / 3, '16:9': 16 / 9 } as const

export function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const aspect = useProjectStore((s) => s.canvas.aspect)
  const quality = useProjectStore((s) => s.canvas.quality)
  const stackLen = useProjectStore((s) => s.stack.length)
  const audio = useAudio()
  const W = 720
  const H = Math.round(W / RATIO[aspect])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    cv.width = W
    cv.height = H
    const ctx = cv.getContext('2d')
    if (!ctx) return
    let raf = 0
    let t = 0
    const scale = quality === 'low' ? 0.5 : quality === 'med' ? 0.75 : 1
    const loop = () => {
      t += 1 / 60
      const frame = { timeSec: t, dt: 1 / 60, bpm: useProjectStore.getState().timeline.bpm }
      const a = audio.readFrame(frame.bpm)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.save()
      ctx.scale(scale, scale)
      evaluateStack(ctx, frame, a, useProjectStore.getState().stack)
      ctx.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [aspect, quality, stackLen])

  return <canvas ref={ref} id="stage-canvas" className="stage-canvas" data-testid="stage-canvas" style={{ width: W, height: H }} />
}
