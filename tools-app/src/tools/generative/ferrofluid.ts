// tools-app/src/tools/generative/ferrofluid.ts
import type { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import {
  FERROFLOW_ADVECT_FRAG,
  FERROFLOW_THICKNESS_FRAG,
  FERROFLOW_RD_FRAG,
  FERROFLOW_RENDER_FRAG
} from '../../engine/shaders/ferrofluid'
import { ReactionDiffusion, mulberry32 } from '../../engine/rd'
import { strHash } from '../toolUtils'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('ferroflowAdvect', FERROFLOW_ADVECT_FRAG)
    renderer.compileProgram('ferroflowThickness', FERROFLOW_THICKNESS_FRAG)
    renderer.compileProgram('ferroflowRD', FERROFLOW_RD_FRAG)
    renderer.compileProgram('ferroflowRender', FERROFLOW_RENDER_FRAG)
  }
  return renderer
}

function hexToRgbArray(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [242 / 255, 121 / 255, 12 / 255]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

const SIZE_BY_QUALITY = { low: 96, med: 128, high: 160, '4k': 200 } as const

type Sim = {
  rd: ReactionDiffusion
  rng: () => number
  size: number
  seededAttractors: number
  img: ImageData
  tmp: HTMLCanvasElement
  tctx: CanvasRenderingContext2D | null
}
const sims = new Map<string, Sim>()

export function disposeFerrofluidSim(uid: string): void {
  sims.delete(uid)
}

export function pruneFerrofluidSims(activeUids: Set<string>): void {
  for (const uid of Array.from(sims.keys())) {
    if (!activeUids.has(uid)) sims.delete(uid)
  }
}

// Ferrofluid: Gray-Scott reaction-diffusion channels weaving around dark magnetic attractors (Tool-Render.md §1.1).
// 4-pass GPU pipeline: advection → thickness feed → reaction-diffusion → color mapping.
// Falls back to CPU RD when WebGL2 is unavailable.
export const ferrofluidTool: ToolDef = {
  id: 'ferrofluid',
  kind: 'generative',
  version: '3.0.0',
  label: 'Ferrofluid',
  icon: 'atom',
  category: 'Generative',
  defaultParams: { feed: 0.055, kill: 0.062, speed: 1, attractors: 5, accent: '#f2790c' },
  controls: [
    { param: 'feed', label: 'Feed', kind: 'slider', min: 0.01, max: 0.09, step: 0.001 },
    { param: 'kill', label: 'Kill', kind: 'slider', min: 0.03, max: 0.075, step: 0.001 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0, max: 3, step: 0.1 },
    { param: 'attractors', label: 'Attractors', kind: 'slider', min: 0, max: 12, step: 1 },
    { param: 'accent', label: 'Accent', kind: 'color' },
  ],
  render(ctx, _frame, item, audio, stack, gl) {
    const feed = Number(item.params.feed ?? 0.055)
    const kill = Number(item.params.kill ?? 0.062)
    const speed = Number(item.params.speed ?? 1)
    const targetAttractors = Math.max(0, Math.round(Number(item.params.attractors ?? 5)))
    const accentHex = String(item.params.accent ?? '#f2790c')
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    // GPU path: 4-pass ferroflow pipeline
    if (gl) {
      const r = getRenderer(gl)
      const f = Math.min(0.12, Math.max(0.01, feed * (1 + audio.bass * 0.15)))

      // Create/recreate FBOs if needed
      let fbos = r.getFBO('ferroflow')
      if (!fbos || fbos.texA === null) {
        fbos = r.createFBO('ferroflow', w, h, true) // float textures for RD
      }

      const advectProg = r.compileProgram('ferroflowAdvect', FERROFLOW_ADVECT_FRAG)
      const thicknessProg = r.compileProgram('ferroflowThickness', FERROFLOW_THICKNESS_FRAG)
      const rdProg = r.compileProgram('ferroflowRD', FERROFLOW_RD_FRAG)
      const renderProg = r.compileProgram('ferroflowRender', FERROFLOW_RENDER_FRAG)

      if (advectProg && thicknessProg && rdProg && renderProg) {
        const time = _frame.timeSec

        // Pass 1: Flow advection
        r.renderToTexture(advectProg, fbos.texA, fbos.fboB, w, h, {
          u_time: time,
          u_speed: speed,
          u_res: [w, h]
        })

        // Pass 2: Thickness feed
        r.renderToTexture(thicknessProg, fbos.texB, fbos.fboA, w, h, {
          u_time: time,
          u_feed: f,
          u_res: [w, h]
        })

        // Pass 3: Reaction-Diffusion (multiple iterations)
        const iterations = Math.floor(speed * 3) + 1
        let readTex = fbos.texA
        let writeFbo = fbos.fboB
        for (let i = 0; i < iterations; i++) {
          r.renderToTexture(rdProg, readTex, writeFbo, w, h, {
            u_feed: f,
            u_kill: kill,
            u_da: 1.0,
            u_db: 0.5,
            u_res: [w, h]
          })
          // Swap both texture and framebuffer together
          const nextFbo = writeFbo === fbos.fboB ? fbos.fboA : fbos.fboB
          const nextTex = writeFbo === fbos.fboB ? fbos.texB : fbos.texA
          writeFbo = nextFbo
          readTex = nextTex
        }

        // Pass 4: Render to canvas
        r.renderToCanvas(renderProg, readTex, w, h, {
          u_accent: hexToRgbArray(accentHex)
        })
        return
      }
    }

    // CPU fallback: Gray-Scott reaction-diffusion
    const size = SIZE_BY_QUALITY[stack.quality]
    const accent = hexToRgbArray(accentHex)

    let sim = sims.get(item.uid)
    if (!sim || sim.size !== size) {
      const tmp = document.createElement('canvas')
      tmp.width = size
      tmp.height = size
      sim = {
        rd: new ReactionDiffusion(size),
        rng: mulberry32(strHash(item.uid)),
        size,
        seededAttractors: 0,
        img: new ImageData(size, size),
        tmp,
        tctx: tmp.getContext('2d'),
      }
      sims.set(item.uid, sim)
    }

    while (sim.seededAttractors < targetAttractors) {
      sim.rd.stampBlobs(1, sim.rng)
      sim.seededAttractors += 1
    }

    const iterations = Math.min(20, Math.max(1, Math.round(2 + speed * 4)))
    const f = Math.min(0.12, Math.max(0.01, feed * (1 + audio.bass * 0.15)))
    for (let i = 0; i < iterations; i++) sim.rd.step(f, kill)

    if (sim.tctx) {
      sim.rd.writeImageData(sim.img, accent as [number, number, number])
      sim.tctx.putImageData(sim.img, 0, 0)
      ctx.drawImage(sim.tmp, 0, 0, w, h)
    } else {
      // No 2d context available (jsdom): coarse cell sampling keeps the tool functional in tests.
      const img = sim.rd.toImageData(accent as [number, number, number])
      const cw = w / size
      const ch = h / size
      for (let y = 0; y < size; y += 2)
        for (let x = 0; x < size; x += 2) {
          const i4 = (y * size + x) * 4
          ctx.fillStyle = `rgb(${img.data[i4]},${img.data[i4 + 1]},${img.data[i4 + 2]})`
          ctx.fillRect(x * cw, y * ch, cw * 2 + 1, ch * 2 + 1)
        }
    }
  },
}
