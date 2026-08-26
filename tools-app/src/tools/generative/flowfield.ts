// tools-app/src/tools/generative/flowfield.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { FLOWFIELD_FRAG } from '../../engine/shaders/flowfield'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('flowfield', FLOWFIELD_FRAG)
  }
  return renderer
}

export const flowfieldTool: ToolDef = {
  id: 'flowfield',
  kind: 'generative',
  version: '3.0.0',
  label: 'Flowfield',
  icon: 'waves',
  category: 'Generative',
  controls: [
    { param: 'scale', label: 'Scale', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'particles', label: 'Particles', kind: 'slider', min: 100, max: 1000, step: 50 },
    { param: 'color', label: 'Color Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'trails', label: 'Trails', kind: 'slider', min: 0, max: 1, step: 0.1 }
  ],
  defaultParams: { scale: 8, speed: 1, particles: 500, color: 0, trails: 0.5 },
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('flowfield')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('flowfield', w, h)
    }

    const prog = r.compileProgram('flowfield', FLOWFIELD_FRAG)
    if (!prog) return

    const time = frame.timeSec

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_scale: Number(params.scale ?? 8),
      u_speed: Number(params.speed ?? 1),
      u_particles: Number(params.particles ?? 500),
      u_color: Number(params.color ?? 0),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
