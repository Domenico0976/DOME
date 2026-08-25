import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Swarm = { pts: Float32Array; vel: Float32Array; sig: string }
const swarms = new Map<string, Swarm>()

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

    let swarm = swarms.get(item.uid)
    const sig = `${count}|${attN}`
    if (!swarm || swarm.sig !== sig) {
      const rng = mulberry32(strHash(item.uid))
      const pts = new Float32Array(count * 4)
      for (let i = 0; i < count; i++) {
        pts[i * 4] = rng() * stack.width
        pts[i * 4 + 1] = rng() * stack.height
      }
      swarm = { pts, vel: new Float32Array(count * 2), sig }
      swarms.set(item.uid, swarm)
    }

    const atts = Array.from({ length: attN }, (_, i) => {
      const ph = (i / attN) * Math.PI * 2
      return {
        x: stack.width / 2 + Math.cos(ph + t * 0.3) * stack.width * 0.22,
        y: stack.height / 2 + Math.sin(ph * 1.4 + t * 0.24) * stack.height * 0.22,
      }
    })

    const { pts, vel } = swarm
    const pull = 0.001 * (1 + audio.level * 2)
    for (let i = 0; i < count; i++) {
      const x = pts[i * 4]
      const y = pts[i * 4 + 1]
      let fx = 0
      let fy = 0
      for (const a of atts) {
        const dx = a.x - x
        const dy = a.y - y
        const d2 = dx * dx + dy * dy + 40
        fx += (dx / d2) * strength
        fy += (dy / d2) * strength
      }
      vel[i * 2] = (vel[i * 2] + fx * pull) * 0.985
      vel[i * 2 + 1] = (vel[i * 2 + 1] + fy * pull) * 0.985
      let nx = x + vel[i * 2]
      let ny = y + vel[i * 2 + 1]
      if (nx < 0 || nx > stack.width) {
        vel[i * 2] *= -0.7
        nx = Math.min(stack.width, Math.max(0, nx))
      }
      if (ny < 0 || ny > stack.height) {
        vel[i * 2 + 1] *= -0.7
        ny = Math.min(stack.height, Math.max(0, ny))
      }
      pts[i * 4] = nx
      pts[i * 4 + 1] = ny
      ctx.fillStyle = `hsla(${hue}, 85%, 62%, 0.85)`
      ctx.fillRect(nx, ny, 2.2, 2.2)
    }
  },
}
