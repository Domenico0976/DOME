// tools-app/src/tools/generative/molecules.ts
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { MOLECULES_FRAG } from '../../engine/shaders/molecules'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('molecules', MOLECULES_FRAG)
  }
  return renderer
}

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const moleculesTool: ToolDef = {
  id: 'molecules',
  kind: 'generative',
  version: '3.0.0',
  label: 'Molecules',
  icon: 'network',
  category: 'Generative',
  defaultParams: { count: 8, speed: 1, radius: 0.12, hueShift: 0, color: '#ffffff' },
  controls: [
    { param: 'count', label: 'Count', kind: 'slider', min: 1, max: 16, step: 1 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'radius', label: 'Radius', kind: 'slider', min: 0.02, max: 0.3, step: 0.01 },
    { param: 'hueShift', label: 'Hue Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('molecules')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('molecules', w, h)
    }

    const prog = r.compileProgram('molecules', MOLECULES_FRAG)
    if (!prog) return

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_count: Number(p.count ?? 8),
      u_speed: Number(p.speed ?? 1),
      u_radius: Number(p.radius ?? 0.12),
      u_hueShift: Number(p.hueShift ?? 0),
      u_color: hexToRgb(String(p.color ?? '#ffffff')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
