import type { ToolDef } from '../../core/types'
import { ReactionDiffusion, mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [242, 121, 12]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

const SIZE_BY_QUALITY = { low: 96, med: 128, high: 160, '4k': 200 } as const

type Sim = {
  rd: ReactionDiffusion
  sig: string
  tmp: HTMLCanvasElement | null
  tctx: CanvasRenderingContext2D | null
}
const sims = new Map<string, Sim>()

// Ferrofluid: Gray-Scott reaction-diffusion channels weaving around dark magnetic attractors (Tool-Render.md §1.1).
export const ferrofluidTool: ToolDef = {
  id: 'ferrofluid',
  kind: 'generative',
  version: '2.0.0',
  label: 'Ferrofluid',
  icon: 'atom',
  category: 'Generative',
  defaultParams: { feed: 0.055, kill: 0.062, scale: 3, speed: 1, attractors: 5, accent: '#f2790c' },
  controls: [
    { param: 'feed', label: 'Feed', kind: 'slider', min: 0.01, max: 0.09, step: 0.001 },
    { param: 'kill', label: 'Kill', kind: 'slider', min: 0.03, max: 0.075, step: 0.001 },
    { param: 'scale', label: 'Scale', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
    { param: 'attractors', label: 'Attractors', kind: 'slider', min: 0, max: 12, step: 1 },
    { param: 'accent', label: 'Accent', kind: 'color' },
  ],
  render(ctx, _frame, item, audio, stack) {
    const feed = Number(item.params.feed ?? 0.055)
    const kill = Number(item.params.kill ?? 0.062)
    const speed = Number(item.params.speed ?? 1)
    const attractors = Number(item.params.attractors ?? 5)
    const accent = hexToRgb(String(item.params.accent ?? '#f2790c'))
    const size = SIZE_BY_QUALITY[stack.quality]

    let sim = sims.get(item.uid)
    const sig = `${attractors}|${size}`
    if (!sim || sim.sig !== sig) {
      const rd = new ReactionDiffusion(size)
      rd.seed(attractors, mulberry32(strHash(item.uid)))
      const tmp = document.createElement('canvas')
      tmp.width = size
      tmp.height = size
      sim = { rd, sig, tmp, tctx: tmp.getContext('2d') }
      sims.set(item.uid, sim)
    }

    const iterations = Math.min(20, Math.max(1, Math.round(2 + speed * 4)))
    const f = Math.min(0.12, Math.max(0.01, feed * (1 + audio.bass * 0.15)))
    for (let i = 0; i < iterations; i++) sim.rd.step(f, kill)

    if (sim.tmp && sim.tctx) {
      sim.tctx.putImageData(sim.rd.toImageData(accent), 0, 0)
      const zoom = Math.max(0.5, Number(item.params.scale ?? 3) / 3)
      const dw = stack.width * zoom
      const dh = stack.height * zoom
      ctx.save()
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(sim.tmp, (stack.width - dw) / 2, (stack.height - dh) / 2, dw, dh)
      ctx.restore()
    } else {
      // No 2d context available (jsdom): coarse cell sampling keeps the tool functional in tests.
      const img = sim.rd.toImageData(accent)
      const cw = stack.width / size
      const ch = stack.height / size
      for (let y = 0; y < size; y += 2)
        for (let x = 0; x < size; x += 2) {
          const i4 = (y * size + x) * 4
          ctx.fillStyle = `rgb(${img.data[i4]},${img.data[i4 + 1]},${img.data[i4 + 2]})`
          ctx.fillRect(x * cw, y * ch, cw * 2 + 1, ch * 2 + 1)
        }
    }
  },
}
