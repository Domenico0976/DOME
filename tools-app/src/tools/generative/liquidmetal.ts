import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { LIQUIDMETAL_SDF_FRAG } from '../../engine/shaders/liquidmetal'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('liquidmetalSDF', LIQUIDMETAL_SDF_FRAG)
  }
  return renderer
}

export const liquidMetalTool: ToolDef = {
  id: 'liquidmetal',
  kind: 'generative',
  version: '3.0.0',
  label: 'Liquid Metal',
  icon: 'gem',
  category: 'Generative',
  defaultParams: { blobs: 5, morph: 0.5, speed: 1, roughness: 0.3, hueShift: 0 },
  controls: [
    { param: 'blobs', label: 'Blobs', kind: 'slider', min: 2, max: 8, step: 1 },
    { param: 'morph', label: 'Morph', kind: 'slider', min: 0.1, max: 1, step: 0.05 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'roughness', label: 'Roughness', kind: 'slider', min: 0, max: 1, step: 0.1 },
    { param: 'hueShift', label: 'Hue Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
  ],
  render: (_ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = _ctx.canvas.width
    const h = _ctx.canvas.height

    let fbos = r.getFBO('liquidmetal')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('liquidmetal', w, h)
    }

    const prog = r.compileProgram('liquidmetalSDF', LIQUIDMETAL_SDF_FRAG)
    if (!prog) return

    const time = frame.timeSec

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_morph: Number(params.morph ?? 0.5),
      u_blobs: Number(params.blobs ?? 5),
      u_speed: Number(params.speed ?? 1),
      u_roughness: Number(params.roughness ?? 0.3),
      u_hueShift: Number(params.hueShift ?? 0),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
