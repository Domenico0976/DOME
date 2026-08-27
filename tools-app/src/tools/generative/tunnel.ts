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

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 0]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const tunnelTool: ToolDef = {
  id: 'tunnel',
  kind: 'generative',
  version: '3.0.0',
  label: 'Tunnel',
  icon: 'circle-dashed',
  category: 'Generative',
  defaultParams: { speed: 1, twist: 3, density: 1, shape: 0, horizon: 0, color: '#ff6b35' },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'twist', label: 'Twist', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'density', label: 'Density', kind: 'slider', min: 0.1, max: 2, step: 0.05 },
    { param: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'triangle', 'square', 'hexagon', 'ellipse', 'rectangle'] },
    { param: 'horizon', label: 'Horizon', kind: 'slider', min: -1, max: 1, step: 0.05 },
    { param: 'color', label: 'Color', kind: 'color' },
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

    const shapeNames = ['circle', 'triangle', 'square', 'hexagon', 'ellipse', 'rectangle']
    const shapeIndex = shapeNames.indexOf(String(p.shape ?? 'circle'))
    const shape = shapeIndex >= 0 ? shapeIndex : 0

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_speed: Number(p.speed ?? 1),
      u_twist: Number(p.twist ?? 3),
      u_density: Number(p.density ?? 1),
      u_horizon: Number(p.horizon ?? 0),
      u_shape: shape,
      u_color: hexToRgb(String(p.color ?? '#ff6b35')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
