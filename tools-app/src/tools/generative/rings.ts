// tools-app/src/tools/generative/rings.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { RINGS_FRAG } from '../../engine/shaders/rings'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('rings', RINGS_FRAG)
  }
  return renderer
}

export const ringsTool: ToolDef = {
  id: 'rings',
  kind: 'generative',
  version: '3.0.0',
  label: 'Rings',
  icon: 'orbit',
  category: 'Generative',
  defaultParams: { count: 8, thick: 0.15, warp: 4, speed: 1 },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 2, max: 20, step: 1 },
    { param: 'thick', label: 'Thickness', kind: 'slider', min: 0.02, max: 0.5, step: 0.01 },
    { param: 'warp', label: 'Warp', kind: 'slider', min: 1, max: 15, step: 0.5 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('rings')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('rings', w, h)
    }

    const prog = r.compileProgram('rings', RINGS_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_count: Number(p.count ?? 8),
      u_thick: Number(p.thick ?? 0.15),
      u_warp: Number(p.warp ?? 4),
      u_speed: Number(p.speed ?? 1),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
