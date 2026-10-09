// tools-app/src/tools/generative/brutalist.ts
// Brutalist: grid-based generative art with independent animated cells.
// Each cell renders a geometric shape (circle, square, triangle, star, cross)
// with per-cell rotation, translation and scale driven by time and audio.
import { ToolDef } from '../../core/types'
import { ToolRenderer } from '../../engine/toolRenderer'
import { BRUTALIST_FRAG } from '../../engine/shaders/brutalist'

let renderer: ToolRenderer | null = null

function getRenderer(gl: WebGL2RenderingContext): ToolRenderer {
  if (!renderer) {
    renderer = new ToolRenderer(gl)
    renderer.compileProgram('brutalist', BRUTALIST_FRAG)
  }
  return renderer
}

function hexToRgb(hex: string): number[] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [1, 1, 1]
  const int = parseInt(m[1], 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255].map(v => v / 255)
}

export const brutalistTool: ToolDef = {
  id: 'brutalist',
  kind: 'generative',
  version: '3.0.0',
  label: 'Brutalist',
  icon: 'grid3x3',
  category: 'Generative',
  defaultParams: { grid: 8, noise: 0.5, speed: 1, shape: 1, phase: 0 },
  controls: [
    { param: 'grid', label: 'Grid', kind: 'slider', min: 2, max: 12, step: 1 },
    { param: 'noise', label: 'Noise', kind: 'slider', min: 0, max: 2, step: 0.05 },
    { param: 'speed', label: 'Speed', kind: 'slider', min: 0.1, max: 3, step: 0.1 },
    { param: 'shape', label: 'Shape', kind: 'select', options: ['circle', 'square', 'triangle', 'star', 'cross'] },
    { param: 'phase', label: 'Phase', kind: 'slider', min: 0, max: 6.28, step: 0.05 },
    { param: 'color', label: 'Color', kind: 'color' },
  ],
  render: (ctx, frame, item, audio, _stack, gl) => {
    if (!gl) return

    const r = getRenderer(gl)
    const p = item.params
    const w = ctx.canvas.width
    const h = ctx.canvas.height

    let fbos = r.getFBO('brutalist')
    if (!fbos || fbos.texA === null) {
      fbos = r.createFBO('brutalist', w, h)
    }

    const prog = r.compileProgram('brutalist', BRUTALIST_FRAG)
    if (!prog) return

    // shape: convert string name → float index 0-4
    const shapeNames = ['circle', 'square', 'triangle', 'star', 'cross']
    const shapeInput = String(p.shape ?? 'square')
    const shapeIdx = shapeNames.indexOf(shapeInput)
    const shapeVal = shapeIdx >= 0 ? shapeIdx : 1

    r.renderToCanvas(prog, fbos.texA, w, h, {
      u_time: frame.timeSec,
      u_grid: Number(p.grid ?? 8),
      u_noise: Number(p.noise ?? 0.5),
      u_speed: Number(p.speed ?? 1),
      u_phase: Number(p.phase ?? 0),
      u_shape: shapeVal,
      u_color: hexToRgb(String(p.color ?? '#ffffff')),
      u_audioLevel: audio.level,
      u_res: [w, h]
    })
  }
}
