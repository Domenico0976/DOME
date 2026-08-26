// tools-app/src/tools/generative/brutalist.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { BRUTALIST_FRAG } from '../../engine/shaders/brutalist'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('brutalist', BRUTALIST_FRAG)
  }
  return renderer
}

export const brutalistTool: ToolDef = {
  id: 'brutalist',
  kind: 'generative',
  version: '3.0.0',
  label: 'Brutalist',
  icon: 'grid3x3',
  category: 'Generative',
  defaultParams: { grid: 8, noise: 0.5, speed: 1 },
  controls: [
    { param: 'grid', label: 'Grid', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'noise', label: 'Noise', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('brutalist')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('brutalist', w, h)
    }

    const prog = r.compileProgram('brutalist', BRUTALIST_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_grid: Number(p.grid ?? 8),
      u_noise: Number(p.noise ?? 0.5),
      u_speed: Number(p.speed ?? 1),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
