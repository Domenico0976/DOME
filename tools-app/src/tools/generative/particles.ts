// tools-app/src/tools/generative/particles.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { PARTICLES_CHLADNI_FRAG } from '../../engine/shaders/particles'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('particlesChladni', PARTICLES_CHLADNI_FRAG)
  }
  return renderer
}

export const particlesTool: ToolDef = {
  id: 'particles',
  kind: 'generative',
  version: '3.0.0',
  label: 'Particles',
  icon: 'sparkles',
  category: 'Generative',
  defaultParams: { count: 500, size: 3, a: 3, b: 2, m: 3, n: 2, freq: 1.5, density: 10 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 50, max: 2000, step: 10 },
    { param: 'size', label: 'Size', kind: 'slider', min: 1, max: 8, step: 0.5 },
    { param: 'a', label: 'A', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'b', label: 'B', kind: 'slider', min: 1, max: 6, step: 1 },
    { param: 'm', label: 'M', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'n', label: 'N', kind: 'slider', min: 1, max: 8, step: 1 },
    { param: 'freq', label: 'Frequency', kind: 'slider', min: 0.5, max: 4, step: 0.1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 1, max: 20, step: 1 }
  ],
  render: (ctx, frame, item, _audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('particles')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('particles', w, h)
    }

    const prog = r.compileProgram('particlesChladni', PARTICLES_CHLADNI_FRAG)
    if (!prog) return

    const time = frame.timeSec

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_a: Number(params.a ?? 3),
      u_b: Number(params.b ?? 2),
      u_m: Number(params.m ?? 3),
      u_n: Number(params.n ?? 2),
      u_freq: Number(params.freq ?? 1.5),
      u_density: Number(params.density ?? 10),
      u_res: [w, h]
    })
  }
}
