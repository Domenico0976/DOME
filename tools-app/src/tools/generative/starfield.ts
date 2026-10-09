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

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const starfieldTool: ToolDef = {
  id: 'starfield',
  kind: 'generative',
  version: '3.0.0',
  label: 'Starfield',
  icon: 'star',
  category: 'Generative',
  defaultParams: { speed: 1, density: 1, zoom: 3, hueShift: 0, starColor: '#ffffff', nebulaColor: '#4466ff' },
  controls: [
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'density', label: 'Density', kind: 'slider', min: 0.1, max: 3, step: 0.05 },
    { param: 'zoom', label: 'Zoom', kind: 'slider', min: 1, max: 10, step: 0.5 },
    { param: 'hueShift', label: 'Hue Shift', kind: 'slider', min: 0, max: 1, step: 0.05 },
    { param: 'starColor', label: 'Star Color', kind: 'color' },
    { param: 'nebulaColor', label: 'Nebula Glow', kind: 'color' },
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
      u_hueShift: Number(p.hueShift ?? 0),
      u_starColor: hexToRgb(String(p.starColor ?? '#ffffff')),
      u_nebulaColor: hexToRgb(String(p.nebulaColor ?? '#4466ff')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
