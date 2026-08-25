import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Swarm = { pts: Float32Array; vel: Float32Array; n: number; rng: () => number }
const swarms = new Map<string, Swarm>()

function ensureSwarm(uid: string, target: number, width: number, height: number): Swarm {
  let s = swarms.get(uid)
  if (!s) {
    s = { pts: new Float32Array(0), vel: new Float32Array(0), n: 0, rng: mulberry32(strHash(uid)) }
    swarms.set(uid, s)
  }
  if (s.n !== target) {
    const keep = Math.min(s.n, target)
    const pts = new Float32Array(target * 2)
    const vel = new Float32Array(target * 2)
    pts.set(s.pts.subarray(0, keep * 2))
    vel.set(s.vel.subarray(0, keep * 2))
    for (let i = s.n; i < target; i++) {
      pts[i * 2] = s.rng() * width
      pts[i * 2 + 1] = s.rng() * height
    }
    s.pts = pts
    s.vel = vel
    s.n = target
  }
  return s
}

// Particles 2: multi-attractor kinematics with inverse-square pull (Tool-Render.md §1.8).
export const particles2Tool: ToolDef = {
  id: 'particles2',
  kind: 'generative',
  version: '1.0.0',
  label: 'Particles 2',
  icon: 'snowflake',
  category: 'Generative',
  defaultParams: { count: 300, attractors: 3, strength: 40, hue: 320 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 50, max: 1500, step: 10 },
    { param: 'attractors', label: 'Attractors', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'strength', label: 'Strength', kind: 'slider', min: 5, max: 200, step: 5 },
    { param: 'hue', label: 'Hue', kind: 'slider', min: 0, max: 360, step: 1 },
  ],
  render(ctx, frame, item, audio, stack) {
    const count = Math.round(Number(item.params.count ?? 300))
    const attN = Math.round(Number(item.params.attractors ?? 3))
    const strength = Number(item.params.strength ?? 40)
    const hue = Number(item.params.hue ?? 320)
    const t = frame.timeSec

    const swarm = ensureSwarm(item.uid, count, stack.width, stack.height)

    const atts = Array.from({ length: attN }, (_, i) => {
      const ph = (i / attN) * Math.PI * 2
      return {
        x: stack.width / 2 + Math.cos(ph + t * 0.3) * stack.width * 0.22,
        y: stack.height / 2 + Math.sin(ph * 1.4 + t * 0.24) * stack.height * 0.22,
      }
    })

    const pull = 0.001 * (1 + audio.level * 2)
    for (let i = 0; i < swarm.n; i++) {
      const x = swarm.pts[i * 2]
      const y = swarm.pts[i * 2 + 1]
      let fx = 0
      let fy = 0
      for (const a of atts) {
        const dx = a.x - x
        const dy = a.y - y
        const d2 = dx * dx + dy * dy + 40
        fx += (dx / d2) * strength
        fy += (dy / d2) * strength
      }
      swarm.vel[i * 2] = (swarm.vel[i * 2] + fx * pull) * 0.985
      swarm.vel[i * 2 + 1] = (swarm.vel[i * 2 + 1] + fy * pull) * 0.985
      let nx = x + swarm.vel[i * 2]
      let ny = y + swarm.vel[i * 2 + 1]
      if (nx < 0 || nx > stack.width) {
        swarm.vel[i * 2] *= -0.7
        nx = Math.min(stack.width, Math.max(0, nx))
      }
      if (ny < 0 || ny > stack.height) {
        swarm.vel[i * 2 + 1] *= -0.7
        ny = Math.min(stack.height, Math.max(0, ny))
      }
      swarm.pts[i * 2] = nx
      swarm.pts[i * 2 + 1] = ny
      ctx.fillStyle = `hsla(${hue}, 85%, 62%, 0.85)`
      ctx.fillRect(nx, ny, 2.2, 2.2)
    }
  },
}
