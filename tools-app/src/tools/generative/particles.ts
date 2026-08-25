import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

// Chladni plate standing wave: superposition of two orthogonal sine modes (Tool-Render.md §1.5).
// Particles drift toward nodal lines where the field crosses zero.
function chladni(x: number, y: number, a: number, b: number, m: number, n: number): number {
  return (
    a * Math.sin(Math.PI * m * x) * Math.sin(Math.PI * n * y) -
    b * Math.sin(Math.PI * n * x) * Math.sin(Math.PI * m * y)
  )
}

type Cloud = { pts: Float32Array; vel: Float32Array; sig: string }
const clouds = new Map<string, Cloud>()

// Particles: dust aggregating along Chladni nodal lines into sabulous textures.
export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '2.0.0',
  label: 'Particles',
  icon: 'sparkles',
  category: 'Generative',
  defaultParams: { count: 400, size: 2, speed: 1, hue: 200, a: 3, b: 4, m: 5, n: 6, damping: 0.96 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 50, max: 2000, step: 10 },
    { param: 'size', label: 'Size', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 4, step: 0.1 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
    { param: 'a', label: 'A', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'b', label: 'B', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'm', label: 'Mode M', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'n', label: 'Mode N', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'damping', label: 'Damping', kind: 'slider', min: 0.8, max: 0.99, step: 0.01 },
  ],
  render(ctx, frame, item, audio, stack) {
    const count = Math.round(Number(item.params.count ?? 400))
    const size = Number(item.params.size ?? 2) * (1 + audio.level * 1.5)
    const a = Number(item.params.a ?? 3)
    const b = Number(item.params.b ?? 4)
    const m = Number(item.params.m ?? 5)
    const n = Number(item.params.n ?? 6)
    const damping = Number(item.params.damping ?? 0.96)
    const hue = Number(item.params.hue ?? 200)

    let cloud = clouds.get(item.uid)
    const sig = `${count}|${a}|${b}|${m}|${n}`
    if (!cloud || cloud.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(count * 2)
      const vel = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        pts[i * 2] = rng()
        pts[i * 2 + 1] = rng()
      }
      cloud = { pts, vel, sig }
      clouds.set(item.uid, cloud)
    }

    const { pts, vel } = cloud
    const dtScale = frame.dt * 60 * Number(item.params.speed ?? 1)
    ctx.save()
    for (let i = 0; i < count; i++) {
      const x = pts[i * 2]
      const y = pts[i * 2 + 1]
      const val = chladni(x, y, a, b, m, n)
      vel[i * 2] -= val * 0.004 * (x > 0.5 ? 1 : -1) * dtScale
      vel[i * 2 + 1] -= val * 0.004 * (y > 0.5 ? 1 : -1) * dtScale
      vel[i * 2] *= damping
      vel[i * 2 + 1] *= damping
      pts[i * 2] = (x + vel[i * 2] + 1) % 1
      pts[i * 2 + 1] = (y + vel[i * 2 + 1] + 1) % 1
      ctx.fillStyle = `hsla(${hue}, 80%, 62%, 0.75)`
      ctx.fillRect(pts[i * 2] * stack.width, pts[i * 2 + 1] * stack.height, size, size)
    }
    ctx.restore()
  },
}
