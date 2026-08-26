// tools-app/src/tools/generative/plasma.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { PLASMA_FRAG } from '../../engine/shaders/plasma'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('plasma', PLASMA_FRAG)
  }
  return renderer
}

export const plasmaTool: ToolDef = {
  id: 'plasma',
  kind: 'generative',
  version: '3.0.0',
  label: 'Plasma',
  icon: 'droplets',
  category: 'Generative',
  defaultParams: { scale: 8, speed: 1, colorShift: 0 },
  controls: [
    { param: 'scale', label: 'Scale', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'colorShift', label: 'Color', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('plasma')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('plasma', w, h)
    }

    const prog = r.compileProgram('plasma', PLASMA_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_scale: Number(p.scale ?? 8),
      u_speed: Number(p.speed ?? 1),
      u_colorShift: Number(p.colorShift ?? 0),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
