// tools-app/src/tools/generative/starfield.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { STARFIELD_FRAG } from '../../engine/shaders/starfield'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('starfield', STARFIELD_FRAG)
  }
  return renderer
}

export const starfieldTool: ToolDef = {
  id: 'starfield',
  kind: 'generative',
  version: '3.0.0',
  label: 'Starfield',
  icon: 'star',
  category: 'Generative',
  defaultParams: { speed: 1, density: 1, zoom: 3 },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 0.1, max: 3, step: 0.05 },
    { param: 'zoom', label: 'Zoom', kind: 'slider', min: 1, max: 10, step: 0.5 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('starfield')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('starfield', w, h)
    }

    const prog = r.compileProgram('starfield', STARFIELD_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_speed: Number(p.speed ?? 1),
      u_density: Number(p.density ?? 1),
      u_zoom: Number(p.zoom ?? 3),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
