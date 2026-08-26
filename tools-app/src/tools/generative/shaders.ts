// tools-app/src/tools/generative/shaders.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { SHADERS_FRAG } from '../../engine/shaders/shaders'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('shaders', SHADERS_FRAG)
  }
  return renderer
}

export const shadersTool: ToolDef = {
  id: 'shaders',
  kind: 'generative',
  version: '3.0.0',
  label: 'Shaders',
  icon: 'aperture',
  category: 'Generative',
  defaultParams: { noiseScale: 4, warp: 1, colorShift: 0, complexity: 4 },
  controls: [
    { param: 'noiseScale', label: 'Scale', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'warp', label: 'Warp', kind: 'slider', min: 0, max: 5, step: 0.1 },
    { param: 'colorShift', label: 'Color', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'complexity', label: 'Complexity', kind: 'slider', min: 1, max: 8, step: 0.5 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const params = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('shaders')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('shaders', w, h)
    }

    const prog = r.compileProgram('shaders', SHADERS_FRAG)
    if (!prog) return

    const time = frame.timeSec

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: time,
      u_noiseScale: Number(params.noiseScale ?? 4),
      u_warp: Number(params.warp ?? 1),
      u_colorShift: Number(params.colorShift ?? 0),
      u_complexity: Number(params.complexity ?? 4),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
