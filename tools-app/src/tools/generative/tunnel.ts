// tools-app/src/tools/generative/tunnel.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { TUNNEL_FRAG } from '../../engine/shaders/tunnel'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('tunnel', TUNNEL_FRAG)
  }
  return renderer
}

export const tunnelTool: ToolDef = {
  id: 'tunnel',
  kind: 'generative',
  version: '3.0.0',
  label: 'Tunnel',
  icon: 'circle-dashed',
  category: 'Generative',
  defaultParams: { speed: 1, twist: 3, density: 1 },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'twist', label: 'Twist', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'density', label: 'Density', kind: 'slider', min: 0.1, max: 2, step: 0.05 },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('tunnel')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('tunnel', w, h)
    }

    const prog = r.compileProgram('tunnel', TUNNEL_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_speed: Number(p.speed ?? 1),
      u_twist: Number(p.twist ?? 3),
      u_density: Number(p.density ?? 1),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
