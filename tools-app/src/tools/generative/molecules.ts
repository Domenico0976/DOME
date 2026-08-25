import type { ToolDef } from '../../core/types'
import { mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

type Net = { seeds: Float32Array; n: number; rng: () => number }
const nets = new Map<string, Net>()

function ensureNet(uid: string, target: number): Net {
  let net = nets.get(uid)
  if (!net) {
    net = { seeds: new Float32Array(0), n: 0, rng: mulberry32(strHash(uid)) }
    nets.set(uid, net)
  }
  if (net.n !== target) {
    const seeds = new Float32Array(target * 4)
    seeds.set(net.seeds.subarray(0, Math.min(net.n, target) * 4))
    for (let i = net.n; i < target; i++) {
      seeds[i * 4] = net.rng()
      seeds[i * 4 + 1] = net.rng()
      seeds[i * 4 + 2] = net.rng() * Math.PI * 2
      seeds[i * 4 + 3] = 0.2 + net.rng() * 0.5
    }
    net.seeds = seeds
    net.n = target
  }
  return net
}

// Molecules: pseudo-3D node/bond lattice with depth-faded opacity (Tool-Render.md §1.2).
export const moleculesTool: ToolDef = {
  id: 'molecules',
  kind: 'generative',
  version: '1.0.0',
  label: 'Molecules',
  icon: 'network',
  category: 'Generative',
  defaultParams: { nodes: 42, linkDistance: 0.18, drift: 0.5 },
  controls: [
    { param: 'nodes', label: 'Nodes', kind: 'slider', min: 10, max: 120, step: 1 },
    { param: 'linkDistance', label: 'Link Distance', kind: 'slider', min: 0.05, max: 0.35, step: 0.01 },
    { param: 'drift', label: 'Drift', kind: 'slider', min: 0, max: 2, step: 0.05 },
  ],
  render(ctx, frame, item, _audio, stack) {
    const nodeN = Math.round(Number(item.params.nodes ?? 42))
    const linkDist = Number(item.params.linkDistance ?? 0.18) * Math.min(stack.width, stack.height)
    const drift = Number(item.params.drift ?? 0.5)
    const t = frame.timeSec

    const net = ensureNet(item.uid, nodeN)

    const px = new Float32Array(nodeN)
    const py = new Float32Array(nodeN)
    const pz = new Float32Array(nodeN)
    for (let i = 0; i < nodeN; i++) {
      const ox = net.seeds[i * 4]
      const oy = net.seeds[i * 4 + 1]
      const ph = net.seeds[i * 4 + 2]
      const rad = net.seeds[i * 4 + 3]
      px[i] = (ox + Math.cos(t * drift * 0.4 + ph) * rad * 0.12) * stack.width
      py[i] = (oy + Math.sin(t * drift * 0.33 + ph * 1.7) * rad * 0.12) * stack.height
      pz[i] = 0.5 + 0.5 * Math.sin(t * drift * 0.5 + ph)
    }

    ctx.save()
    for (let i = 0; i < nodeN; i++)
      for (let j = i + 1; j < nodeN; j++) {
        const dx = px[i] - px[j]
        const dy = py[i] - py[j]
        const d = Math.hypot(dx, dy)
        if (d > linkDist) continue
        const depthAlpha = 1 - (pz[i] + pz[j]) / 2
        ctx.strokeStyle = `rgba(200,220,255,${depthAlpha * 0.8})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(px[i], py[i])
        ctx.lineTo(px[j], py[j])
        ctx.stroke()
      }
    for (let i = 0; i < nodeN; i++) {
      const rr = 3 + (1 - pz[i]) * 4
      ctx.fillStyle = `rgba(200,220,255,${1 - pz[i]})`
      ctx.beginPath()
      ctx.arc(px[i], py[i], rr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  },
}
