import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Ink = { strokes: Float32Array[]; sig: string }
const inkCache = new Map<string, Ink>()

// Doodle: hand-drawn jittered quadratic ink strokes on black (Tool-Render.md §1.6).
// Stroke skeletons are deterministic per uid; the live jitter is intentionally random each frame.
export const doodleTool: ToolDef = {
  id: 'doodle',
  kind: 'generative',
  version: '1.0.0',
  label: 'Doodle',
  icon: 'brush',
  category: 'Generative',
  defaultParams: { strokes: 24, jitter: 2, width: 3 },
  controls: [
    { param: 'strokes', label: 'Strokes', kind: 'slider', min: 4, max: 80, step: 1 },
    { param: 'jitter', label: 'Jitter', kind: 'slider', min: 0.5, max: 6, step: 0.5 },
    { param: 'width', label: 'Width', kind: 'slider', min: 1, max: 10, step: 0.5 },
  ],
  render(ctx, frame, item, audio, stack) {
    const strokeN = Math.round(Number(item.params.strokes ?? 24))
    const jitter = Number(item.params.jitter ?? 2)
    const width = Number(item.params.width ?? 3)

    let ink = inkCache.get(item.uid)
    const sig = `${strokeN}`
    if (!ink || ink.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const strokes: Float32Array[] = []
      for (let s = 0; s < strokeN; s++) {
        const pts = new Float32Array(24 * 2)
        let x = rng() * stack.width
        let y = rng() * stack.height
        let ang = rng() * Math.PI * 2
        for (let p = 0; p < 24; p++) {
          ang += (rng() - 0.5) * 1.2
          x += Math.cos(ang) * stack.width * 0.02
          y += Math.sin(ang) * stack.height * 0.02
          pts[p * 2] = x
          pts[p * 2 + 1] = y
        }
        strokes.push(pts)
      }
      ink = { strokes, sig }
      inkCache.set(item.uid, ink)
    }

    ctx.save()
    if ('filter' in ctx) ctx.filter = 'blur(0.6px)'
    ctx.strokeStyle = `rgba(255,255,255,${0.75 + audio.treble * 0.2})`
    const wobble = Math.sin(frame.timeSec * 0.8) * 0.4
    for (const pts of ink.strokes) {
      ctx.lineWidth = width + wobble
      ctx.beginPath()
      ctx.moveTo(pts[0], pts[1])
      for (let p = 1; p < pts.length / 2 - 2; p++) {
        const jx = (Math.random() - 0.5) * jitter
        const jy = (Math.random() - 0.5) * jitter
        ctx.quadraticCurveTo(pts[p * 2] + jx, pts[p * 2 + 1] + jy, pts[(p + 1) * 2], pts[(p + 1) * 2 + 1])
      }
      ctx.stroke()
    }
    ctx.restore()
  },
}
