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

type Cloud = { pts: Float32Array; vel: Float32Array; n: number; rng: () => number }
const clouds = new Map<string, Cloud>()

function ensureCloud(uid: string, target: number): Cloud {
  let c = clouds.get(uid)
  if (!c) {
    c = { pts: new Float32Array(0), vel: new Float32Array(0), n: 0, rng: mulberry32(strHash(uid)) }
    clouds.set(uid, c)
  }
  if (c.n !== target) {
    const keep = Math.min(c.n, target)
    const pts = new Float32Array(target * 2)
    const vel = new Float32Array(target * 2)
    pts.set(c.pts.subarray(0, keep * 2))
    vel.set(c.vel.subarray(0, keep * 2))
    for (let i = c.n; i < target; i++) {
      pts[i * 2] = c.rng()
      pts[i * 2 + 1] = c.rng()
    }
    c.pts = pts
    c.vel = vel
    c.n = target
  }
  return c
}

// Particles: dust aggregating along Chladni nodal lines into sabulous textures.
// Field params are read live each frame so tuning migrates the existing cloud smoothly.
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
    const pa = Number(item.params.a ?? 3)
    const pb = Number(item.params.b ?? 4)
    const pm = Number(item.params.m ?? 5)
    const pn = Number(item.params.n ?? 6)
    const damping = Number(item.params.damping ?? 0.96)
    const hue = Number(item.params.hue ?? 200)

    const cloud = ensureCloud(item.uid, count)

    const dtScale = frame.dt * 60 * Number(item.params.speed ?? 1)
    ctx.save()
    for (let i = 0; i < cloud.n; i++) {
      const x = cloud.pts[i * 2]
      const y = cloud.pts[i * 2 + 1]
      const val = chladni(x, y, pa, pb, pm, pn)
      cloud.vel[i * 2] -= val * 0.004 * (x > 0.5 ? 1 : -1) * dtScale
      cloud.vel[i * 2 + 1] -= val * 0.004 * (y > 0.5 ? 1 : -1) * dtScale
      cloud.vel[i * 2] *= damping
      cloud.vel[i * 2 + 1] *= damping
      cloud.pts[i * 2] = (x + cloud.vel[i * 2] + 1) % 1
      cloud.pts[i * 2 + 1] = (y + cloud.vel[i * 2 + 1] + 1) % 1
      ctx.fillStyle = `hsla(${hue}, 80%, 62%, 0.75)`
      ctx.fillRect(cloud.pts[i * 2] * stack.width, cloud.pts[i * 2 + 1] * stack.height, size, size)
    }
    ctx.restore()
  },
}
