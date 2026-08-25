import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Starts = { pts: Float32Array; sig: string }
const startsCache = new Map<string, Starts>()

// Flow Field: thousands of short streamlines integrated through an animated angle field
// (curl-noise surrogate per Tool-Render.md §1.2-style flow rendering).
export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '2.0.0',
  label: 'Flow Field',
  icon: 'waves',
  category: 'Generative',
  defaultParams: { segments: 600, steplen: 2.5, curl: 1, hue: 180 },
  controls: [
    { param: 'segments', label: 'Segments', kind: 'slider', min: 100, max: 2000, step: 10 },
    { param: 'steplen', label: 'Step Length', kind: 'slider', min: 0.5, max: 6, step: 0.1 },
    { param: 'curl', label: 'Curl', kind: 'slider', min: 0.2, max: 3, step: 0.05 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const segCount = Math.round(Number(item.params.segments ?? 600))
    const steplen = Number(item.params.steplen ?? 2.5)
    const curl = Number(item.params.curl ?? 1)
    const hue = Number(item.params.hue ?? 180)
    const t = frame.timeSec

    let starts = startsCache.get(item.uid)
    const sig = `${segCount}|${stack.width}x${stack.height}`
    if (!starts || starts.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(segCount * 2)
      for (let i = 0; i < segCount; i++) {
        pts[i * 2] = rng() * stack.width
        pts[i * 2 + 1] = rng() * stack.height
      }
      starts = { pts, sig }
      startsCache.set(item.uid, starts)
    }

    const angle = (px: number, py: number) =>
      (Math.sin(px * 0.008 * curl + t * 0.4) + Math.cos(py * 0.011 * curl - t * 0.3)) * Math.PI

    ctx.save()
    ctx.lineWidth = 1.25
    const K = 14
    for (let i = 0; i < segCount; i++) {
      let x = starts.pts[i * 2]
      let y = starts.pts[i * 2 + 1]
      ctx.strokeStyle = `hsla(${(hue + ((i * 7) % 40)) % 360}, 70%, 60%, 0.32)`
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < K; k++) {
        const a = angle(x, y)
        x += Math.cos(a) * steplen
        y += Math.sin(a) * steplen
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.restore()
  },
}
